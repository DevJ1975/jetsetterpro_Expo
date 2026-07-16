// flightAgent — the Genkit-powered flight search-and-rank specialist behind
// IRIS's in-chat booking. Single-shot per request (NOT a conversation owner):
// IRIS calls it as a tool; it runs a bounded server-side Genkit tool loop over
// live Duffel data (search + optional per-offer detail checks) and returns a
// compact, validated shortlist. This keeps IRIS's transcript lean (top ≤5
// offers instead of 20 raw ones) and does the heavy compare server-side where
// the full data lives.
//
// Safety: this function is READ-ONLY against Duffel — it can search and
// inspect offers, never create or cancel orders. Booking/cancellation commits
// happen only via `duffelApi` after the user's explicit in-app confirmation.
// Prices in the response are joined from real offers by id (lib/rank.js), so
// the model can rank but can never invent or mistranscribe an amount.
//
//   POST { task: 'searchAndRank', origin, destination, departureDate,
//          returnDate?, cabinClass?, preferences?, model? }
//   → { summary, topOffers: [{ offerId, totalAmount, totalCurrency, carrier,
//       carrierIata?, departISO?, arriveISO?, stops, durationISO?, expiresAt?,
//       reason? }], searchedAt }
const { onRequest } = require('firebase-functions/v2/https');
const { z } = require('genkit');
const { verifyBearer } = require('./lib/auth');
const { makeLimiter } = require('./lib/rate');
const { getAI, claudeModel } = require('./genkit');
const { duffel, searchOffersOp, IATA_RE, DATE_RE, OFFER_ID_RE } = require('./lib/duffelClient');
const { leanOffers, joinPicks, trimOfferForModel } = require('./lib/rank');

// Each call = up to 4 Claude turns + 1–2 Duffel calls, so keep this tighter
// than duffelApi's 15/min. maxInstances (global) caps the worst case.
const limited = makeLimiter(6, 60_000);

const CABINS = new Set(['economy', 'premium_economy', 'business', 'first']);

// Server-owned prompt — iterate ranking behavior without an app release.
const RANKER_SYSTEM = `You are the flight-search specialist for JetSetter Pro, a premium travel app.
Call searchFlights once to get live bookable offers. If two or three look promising and
comparable, you may check up to 2 of them with getOfferDetails (bags, change/refund rules).
Then answer with JSON matching the schema: a "summary" (under 120 words — compare the
standouts plainly, note any bag or refund gotchas) and "picks" (1–5 offer ids from the
search results, best value first unless the traveler's preferences say otherwise, each
with a short reason). Use ONLY offer ids that searchFlights returned. If there are no
offers, say so in the summary and pick nothing.`;

const RankSchema = z.object({
  summary: z.string(),
  picks: z
    .array(z.object({ offerId: z.string(), reason: z.string() }))
    .max(5),
});

const flightAgent = onRequest(
  {
    secrets: ['ANTHROPIC_API_KEY', 'DUFFEL_API_KEY'],
    cors: true,
    // One search + a few model turns; well under aiIris's streaming budget.
    timeoutSeconds: 120,
    memory: '512MiB',
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'method_not_allowed' });
      return;
    }
    const user = await verifyBearer(req, res);
    if (!user) return;
    if (!process.env.ANTHROPIC_API_KEY) {
      res.status(503).json({ error: 'ai_unconfigured' });
      return;
    }
    if (limited(user.uid)) {
      res.status(429).json({ error: 'rate_limited' });
      return;
    }

    const body = req.body || {};
    const origin = String(body.origin || '').trim().toUpperCase();
    const destination = String(body.destination || '').trim().toUpperCase();
    const departureDate = String(body.departureDate || '').trim();
    const returnDate = body.returnDate ? String(body.returnDate).trim() : undefined;
    if (
      body.task !== 'searchAndRank' ||
      !IATA_RE.test(origin) ||
      !IATA_RE.test(destination) ||
      !DATE_RE.test(departureDate) ||
      (returnDate && !DATE_RE.test(returnDate))
    ) {
      res.status(400).json({ error: 'bad_request' });
      return;
    }
    const cabinClass = CABINS.has(body.cabinClass) ? body.cabinClass : 'economy';
    const preferences = String(body.preferences || '').slice(0, 400);
    const searchParams = {
      origin,
      destination,
      departureDate,
      returnDate,
      cabinClass,
      passengers: [{ type: 'adult' }],
    };

    try {
      const ai = getAI();
      // Request-scoped cache of the REAL offers the model saw — the response's
      // topOffers are joined from here by id, never from model-generated text.
      const offersBag = new Map();

      const searchTool = ai.dynamicTool(
        {
          name: 'searchFlights',
          description:
            'Run the live flight search for the requested route, date(s) and cabin. Returns bookable offers with prices. Call once.',
          inputSchema: z.object({}),
        },
        async () => {
          const r = await searchOffersOp(searchParams);
          for (const o of r.offers) offersBag.set(o.id, o);
          return { count: r.offers.length, offers: leanOffers(r.offers) };
        },
      );

      const detailsTool = ai.dynamicTool(
        {
          name: 'getOfferDetails',
          description:
            'Bag allowance and change/refund conditions for ONE offer id from searchFlights. Use for at most 2 finalists.',
          inputSchema: z.object({ offerId: z.string() }),
        },
        async ({ offerId }) => {
          if (!OFFER_ID_RE.test(offerId || '') || !offersBag.has(offerId)) {
            return { error: 'unknown_offer_id' };
          }
          const offer = await duffel(`/air/offers/${offerId}?return_available_services=true`);
          return trimOfferForModel(offer);
        },
      );

      const result = await ai.generate({
        model: claudeModel(typeof body.model === 'string' ? body.model : undefined),
        system: RANKER_SYSTEM,
        prompt:
          `Route: ${origin} -> ${destination}, departing ${departureDate}` +
          (returnDate ? `, returning ${returnDate}` : ', one-way') +
          `. Cabin: ${cabinClass}. Traveler preferences: ${preferences || 'none stated'}.`,
        tools: [searchTool, detailsTool],
        maxTurns: 4,
        config: { maxOutputTokens: 1024 },
        output: { schema: RankSchema },
      });

      // Structured output is SIMULATED for our model ids (plugin's known-model
      // list is one release behind) — output can be null on a bad parse, and
      // picks can name unknown ids. joinPicks drops those and falls back to
      // the cheapest real offers, so the endpoint always returns bookable data.
      const out = result.output || null;
      const offers = [...offersBag.values()];
      const topOffers = joinPicks(out ? out.picks : [], offers);
      const summary =
        ((out && out.summary) || result.text || '').trim() ||
        (offers.length ? 'Here are the best options I found.' : 'No flights found for that search.');
      res.json({ summary, topOffers, searchedAt: new Date().toISOString() });
    } catch (err) {
      const code = err && err.code;
      if (code === 'unconfigured') res.status(503).json({ error: 'duffel_unconfigured' });
      else if (code === 'bad_request') res.status(400).json({ error: 'bad_request' });
      else if (code === 'upstream') res.status(502).json({ error: 'upstream_error', details: err.details });
      else res.status(502).json({ error: 'agent_failed' });
    }
  },
);

module.exports = { flightAgent };
