// rank — pure offer-shaping helpers for the flightAgent Genkit flow. No
// dependencies, no I/O: everything the model sees and everything the client
// receives is derived deterministically here from real Duffel offers, so the
// model can pick offers but can never invent or mistranscribe a price.

/** Max offers shown to the model (token guard; search already caps at 20). */
const LEAN_CAP = 16;

function firstSlice(o) {
  return (o.slices && o.slices[0]) || {};
}
function lastSegment(s) {
  const segs = s.segments || [];
  return segs[segs.length - 1] || {};
}

/** Compact, flat projection of summarized offers for the model prompt. */
function leanOffers(offers) {
  return (offers || []).slice(0, LEAN_CAP).map((o) => {
    const s0 = firstSlice(o);
    const segs = s0.segments || [];
    return {
      id: o.id,
      price: `${o.total_amount} ${o.total_currency}`,
      carrier: (o.owner && o.owner.name) || undefined,
      route: `${s0.origin || '?'}->${s0.destination || '?'}`,
      depart: (segs[0] && segs[0].departing_at) || undefined,
      arrive: lastSegment(s0).arriving_at || undefined,
      stops: Math.max(0, segs.length - 1),
      duration: s0.duration || undefined,
      expires_at: o.expires_at,
      slices: (o.slices || []).length,
    };
  });
}

/** One ranked offer for the client, built ONLY from a real Duffel offer. */
function toRankedOffer(o, reason) {
  const s0 = firstSlice(o);
  const segs = s0.segments || [];
  return {
    offerId: o.id,
    totalAmount: o.total_amount,
    totalCurrency: o.total_currency,
    carrier: (o.owner && o.owner.name) || undefined,
    carrierIata: (o.owner && o.owner.iata_code) || undefined,
    departISO: (segs[0] && segs[0].departing_at) || undefined,
    arriveISO: lastSegment(s0).arriving_at || undefined,
    stops: Math.max(0, segs.length - 1),
    durationISO: s0.duration || undefined,
    expiresAt: o.expires_at,
    reason: reason || undefined,
  };
}

/**
 * Join the model's picks (ids + reasons) back to the real offers it saw.
 * Unknown/duplicate ids are dropped; if nothing survives (bad parse,
 * hallucinated ids), fall back to the 5 cheapest real offers so the endpoint
 * still returns bookable results.
 */
function joinPicks(picks, offers) {
  const byId = new Map((offers || []).map((o) => [o.id, o]));
  const seen = new Set();
  const joined = [];
  for (const p of picks || []) {
    if (!p || typeof p.offerId !== 'string') continue;
    const o = byId.get(p.offerId);
    if (!o || seen.has(o.id)) continue;
    seen.add(o.id);
    joined.push(toRankedOffer(o, typeof p.reason === 'string' ? p.reason.slice(0, 200) : undefined));
    if (joined.length >= 5) break;
  }
  if (joined.length > 0) return joined;
  return (offers || [])
    .slice()
    .sort((a, b) => Number(a.total_amount) - Number(b.total_amount))
    .slice(0, 5)
    .map((o) => toRankedOffer(o));
}

/** Tolerant trim of a FULL Duffel offer for the model (conditions/bags/price). */
function trimOfferForModel(offer) {
  const cond = (offer && offer.conditions) || {};
  const fmtCond = (c) =>
    !c
      ? 'unknown'
      : `${c.allowed ? 'allowed' : 'not allowed'}${c.penalty_amount ? ` (penalty ${c.penalty_amount} ${c.penalty_currency || ''})` : ''}`;
  let bags = 0;
  try {
    const seg = offer.slices[0].segments[0];
    bags = (seg.passengers[0].baggages || [])
      .filter((b) => b.type === 'checked')
      .reduce((n, b) => n + (b.quantity || 0), 0);
  } catch {
    bags = 0;
  }
  const paidBagServices = ((offer && offer.available_services) || []).filter(
    (s) => s.type === 'baggage',
  ).length;
  return {
    id: offer && offer.id,
    price:
      offer && offer.total_amount ? `${offer.total_amount} ${offer.total_currency || ''}`.trim() : 'unknown',
    expires_at: offer && offer.expires_at,
    change: fmtCond(cond.change_before_departure),
    refund: fmtCond(cond.refund_before_departure),
    checked_bags_included: bags,
    paid_bag_options: paidBagServices,
  };
}

module.exports = { leanOffers, joinPicks, toRankedOffer, trimOfferForModel, LEAN_CAP };
