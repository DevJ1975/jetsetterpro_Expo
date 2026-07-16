// Pure logic behind IRIS's in-chat flight booking — every money-adjacent rule
// (identity validation, payload construction, expiry, display strings) without
// mocks. The executor/staging behavior is covered in irisBookingTools.test.ts.
import {
  buildCreateOrderPayload,
  describeOrders,
  formatRankedOffers,
  fullOfferToSummary,
  offerExpired,
  summarizeBookingForConfirm,
  trimOfferDetailsForModel,
  validatePassenger,
  type PassengerDraft,
} from '@/src/core/ai/iris/booking';
import type { SearchAndRankResult } from '@/src/core/api/flightAgent';
import type { DuffelOfferSummary, DuffelOrderSummary } from '@/src/core/api/duffel';

const NOW = new Date('2026-07-16T12:00:00.000Z');

const goodInput = {
  givenName: 'Amira',
  familyName: 'Khan',
  bornOn: '1990-01-01',
  gender: 'f',
  title: 'ms',
  email: 'amira@example.com',
  phone: '+14155550123',
};

describe('validatePassenger', () => {
  it('accepts a complete adult passenger and normalizes fields', () => {
    const v = validatePassenger({ ...goodInput, gender: 'F', title: 'MS', phone: '+1 (415) 555-0123' }, NOW);
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.passenger.gender).toBe('f');
      expect(v.passenger.title).toBe('ms');
      expect(v.passenger.phone).toBe('+14155550123'); // spaces/() /- stripped
    }
  });

  it.each([
    [{ givenName: '' }, 'given'],
    [{ familyName: '' }, 'family'],
    [{ bornOn: '01/01/1990' }, 'YYYY-MM-DD'],
    [{ bornOn: '1990-02-31' }, 'YYYY-MM-DD'], // calendar rollover rejected
    [{ bornOn: '2010-01-01' }, 'adult'], // under 18 at NOW
    [{ bornOn: '1910-01-01' }, 'implausible'], // over 110
    [{ gender: 'x' }, 'gender'],
    [{ title: 'prof' }, 'title'],
    [{ email: 'not-an-email' }, 'email'],
    [{ phone: '4155550123' }, 'country code'], // missing +CC
  ])('rejects %j', (patch, needle) => {
    const v = validatePassenger({ ...goodInput, ...patch }, NOW);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.problems.join('; ')).toContain(needle);
  });

  it('aggregates multiple problems in one pass', () => {
    const v = validatePassenger({}, NOW);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.problems.length).toBeGreaterThanOrEqual(5);
  });

  it('accepts an adult who turns 18 today (calendar age, not a 365.25-day average)', () => {
    // Exactly 18 years before NOW — the 365.25 average wrongly computed 17.99.
    const v = validatePassenger({ ...goodInput, bornOn: '2008-07-16' }, NOW);
    expect(v.ok).toBe(true);
  });
  it('still rejects one day short of 18', () => {
    const v = validatePassenger({ ...goodInput, bornOn: '2008-07-17' }, NOW);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.problems.join('; ')).toContain('adult');
  });
});

describe('buildCreateOrderPayload', () => {
  it('maps the Duffel passenger id and renames fields to the wire shape', () => {
    const p = (validatePassenger(goodInput, NOW) as { ok: true; passenger: PassengerDraft }).passenger;
    const payload = buildCreateOrderPayload({ id: 'off_x', passengers: [{ id: 'pas_1' }] }, p);
    expect(payload.selected_offers).toEqual(['off_x']);
    expect(payload.services).toEqual([]);
    expect(payload.passengers).toEqual([
      {
        id: 'pas_1',
        given_name: 'Amira',
        family_name: 'Khan',
        born_on: '1990-01-01',
        gender: 'f',
        title: 'ms',
        email: 'amira@example.com',
        phone_number: '+14155550123',
      },
    ]);
  });
});

describe('offerExpired', () => {
  const now = NOW.getTime();
  it('is expired inside the 90s skew and valid outside it', () => {
    expect(offerExpired(new Date(now + 91_000).toISOString(), 90_000, now)).toBe(false);
    expect(offerExpired(new Date(now + 89_000).toISOString(), 90_000, now)).toBe(true);
    expect(offerExpired(new Date(now - 1000).toISOString(), 90_000, now)).toBe(true);
  });
  it('treats missing/garbage expiry as expired (conservative)', () => {
    expect(offerExpired(undefined, 90_000, now)).toBe(true);
    expect(offerExpired('not-a-date', 90_000, now)).toBe(true);
  });
});

const summaryOffer: DuffelOfferSummary = {
  id: 'off_1',
  total_amount: '412.30',
  total_currency: 'USD',
  expires_at: '2026-07-16T12:25:00.000Z',
  owner: { name: 'British Airways', iata_code: 'BA' },
  slices: [
    {
      origin: 'JFK',
      destination: 'LHR',
      duration: 'PT7H5M',
      segments: [{ departing_at: '2026-08-14T08:05:00Z', arriving_at: '2026-08-14T20:10:00Z' }],
    },
  ],
  passengers: [{ id: 'pas_1', type: 'adult' }],
};

describe('fullOfferToSummary', () => {
  it('flattens the nested full-offer shape and drops id-less passengers', () => {
    const s = fullOfferToSummary({
      id: 'off_1',
      total_amount: '412.30',
      total_currency: 'USD',
      expires_at: '2026-07-16T12:25:00.000Z',
      owner: { name: 'British Airways', iata_code: 'BA' },
      slices: [
        {
          origin: { iata_code: 'JFK' },
          destination: { iata_code: 'LHR' },
          segments: [{ departing_at: '2026-08-14T08:05:00Z', arriving_at: '2026-08-14T20:10:00Z' }],
        },
      ],
      passengers: [{ id: 'pas_1', type: 'adult' }, { type: 'adult' }],
    });
    expect(s.slices[0]?.origin).toBe('JFK');
    expect(s.slices[0]?.destination).toBe('LHR');
    expect(s.passengers).toEqual([{ id: 'pas_1', type: 'adult' }]);
  });
  it('tolerates an empty object', () => {
    const s = fullOfferToSummary({});
    expect(s.id).toBe('');
    expect(s.slices).toEqual([]);
    expect(s.passengers).toEqual([]);
  });
});

describe('summarizeBookingForConfirm', () => {
  it('carries route, carrier, TOTAL with currency, and passenger name', () => {
    const p = (validatePassenger(goodInput, NOW) as { ok: true; passenger: PassengerDraft }).passenger;
    const s = summarizeBookingForConfirm(summaryOffer, p);
    expect(s).toContain('JFK→LHR');
    expect(s).toContain('British Airways');
    expect(s).toContain('412.30 USD');
    expect(s).toContain('Amira Khan');
    expect(s).toContain('test mode');
  });
});

describe('formatRankedOffers', () => {
  const result: SearchAndRankResult = {
    summary: 'The Delta is cheapest; BA is the only nonstop.',
    topOffers: [
      {
        offerId: 'off_1',
        totalAmount: '412.30',
        totalCurrency: 'USD',
        carrier: 'British Airways',
        departISO: '2026-08-14T08:05:00Z',
        arriveISO: '2026-08-14T20:10:00Z',
        stops: 0,
        reason: 'only nonstop',
      },
      { offerId: 'off_2', totalAmount: '366.00', totalCurrency: 'USD', carrier: 'Delta', stops: 1 },
    ],
    searchedAt: NOW.toISOString(),
  };
  const q = { origin: 'JFK', destination: 'LHR', departureDate: '2026-08-14' };

  it('lists ids, prices, stops, the agent summary, and the expiry rule', () => {
    const s = formatRankedOffers(result, q);
    expect(s).toContain('off_1');
    expect(s).toContain('412.30 USD');
    expect(s).toContain('nonstop');
    expect(s).toContain('1 stop');
    expect(s).toContain('NOTES: The Delta is cheapest');
    expect(s).toContain('expire');
    expect(s).toContain('bookFlight');
  });

  it('states clearly when nothing was found', () => {
    const s = formatRankedOffers({ ...result, topOffers: [] }, q);
    expect(s).toContain('No bookable flights');
  });
});

describe('trimOfferDetailsForModel', () => {
  it('summarizes price, conditions, and included bags', () => {
    const s = trimOfferDetailsForModel({
      id: 'off_1',
      total_amount: '412.30',
      total_currency: 'USD',
      expires_at: new Date(Date.now() + 20 * 60_000).toISOString(),
      conditions: {
        change_before_departure: { allowed: true, penalty_amount: '150.00', penalty_currency: 'USD' },
        refund_before_departure: { allowed: false },
      },
      slices: [{ segments: [{ passengers: [{ baggages: [{ type: 'checked', quantity: 1 }] }] }] }],
    });
    expect(s).toContain('412.30 USD');
    expect(s).toContain('changes allowed (penalty 150.00 USD)');
    expect(s).toContain('refund not allowed');
    expect(s).toContain('checked bags included: 1');
  });
  it('is tolerant of an empty offer and flags missing expiry as expired', () => {
    const s = trimOfferDetailsForModel({});
    expect(s).toContain('unknown');
    expect(s).toContain('EXPIRED');
  });
});

describe('describeOrders', () => {
  it('handles the empty state', () => {
    expect(describeOrders([])).toBe('No bookings yet.');
  });
  it('lists reference, route, price, and cancellation state', () => {
    const orders: DuffelOrderSummary[] = [
      {
        id: 'ord_1',
        bookingReference: 'ABC123',
        totalAmount: '412.30',
        totalCurrency: 'USD',
        slices: [{ origin: 'JFK', destination: 'LHR', departingAt: '2026-08-14T08:05:00Z' }],
      },
      { id: 'ord_2', cancelled: true, refundAmount: '200.00', refundCurrency: 'USD', slices: [] },
    ];
    const s = describeOrders(orders);
    expect(s).toContain('ABC123');
    expect(s).toContain('JFK→LHR');
    expect(s).toContain('412.30 USD');
    expect(s).toContain('CANCELLED');
    expect(s).toContain('refunded 200.00 USD');
  });
});
