import {
  describeProductBookings,
  formatCarResults,
  formatStayResults,
  summarizeCarForConfirm,
  summarizeStayForConfirm,
  validateDriver,
  validateGuest,
} from '@/src/core/ai/iris/travelBooking';

const NOW = new Date('2026-07-16T12:00:00Z');

describe('validateGuest', () => {
  it('accepts a complete guest and normalizes the phone', () => {
    const v = validateGuest({ givenName: 'Amira', familyName: 'Khan', email: 'a@b.com', phone: '+1 (415) 555-0123' });
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.guest.phone_number).toBe('+14155550123');
  });
  it('rejects a bad email/phone with aggregated problems', () => {
    const v = validateGuest({ givenName: '', familyName: 'Khan', email: 'no', phone: '415' });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.problems.length).toBeGreaterThanOrEqual(3);
  });
});

describe('validateDriver', () => {
  const base = { givenName: 'Amira', familyName: 'Khan', email: 'a@b.com', phone: '+14155550123' };
  it('accepts an adult driver', () => {
    const v = validateDriver({ ...base, bornOn: '1990-01-01' }, NOW);
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.driver.date_of_birth).toBe('1990-01-01');
  });
  it('rejects an under-18 or malformed DOB', () => {
    expect(validateDriver({ ...base, bornOn: '2015-01-01' }, NOW).ok).toBe(false);
    expect(validateDriver({ ...base, bornOn: '01/01/1990' }, NOW).ok).toBe(false);
  });
  it('accepts a driver who turns 18 today (calendar age)', () => {
    expect(validateDriver({ ...base, bornOn: '2008-07-16' }, NOW).ok).toBe(true);
  });
});

describe('formatters', () => {
  it('lists hotels with ids + prices, or an empty message', () => {
    const s = formatStayResults(
      [{ id: 'ssr_1', name: 'The Grand', rating: 5, amount: '220.00', currency: 'USD' }],
      'Paris',
    );
    expect(s).toContain('ssr_1');
    expect(s).toContain('The Grand');
    expect(s).toContain('220.00 USD');
    expect(formatStayResults([], 'Paris')).toContain('No hotels');
  });
  it('lists cars with rate ids', () => {
    const s = formatCarResults(
      [{ rateId: 'rat_1', car: 'Corolla', category: 'compact', transmission: 'automatic', seats: 5, amount: '48.00', currency: 'USD', supplier: 'Hertz' }],
      'LAX',
    );
    expect(s).toContain('rat_1');
    expect(s).toContain('Corolla');
    expect(s).toContain('Hertz');
  });
  it('summarizes a stay with refundability + guest', () => {
    const s = summarizeStayForConfirm(
      { roomName: 'King', amount: '220.00', currency: 'USD', refundable: true, freeCancelBy: '2026-08-01T00:00:00Z' },
      { given_name: 'Amira', family_name: 'Khan', email: 'a@b.com', phone_number: '+14155550123' },
      'Paris',
    );
    expect(s).toContain('220.00 USD');
    expect(s).toContain('Free cancellation until 2026-08-01');
    expect(s).toContain('Amira Khan');
  });
  it('summarizes a car with driver', () => {
    const s = summarizeCarForConfirm(
      { amount: '48.00', currency: 'USD' },
      { given_name: 'Amira', family_name: 'Khan', email: 'a@b.com', phone_number: '+14155550123', date_of_birth: '1990-01-01' },
      'LAX',
    );
    expect(s).toContain('48.00 USD');
    expect(s).toContain('Amira Khan');
  });
  it('describes bookings and the empty state', () => {
    expect(describeProductBookings([], 'hotel')).toBe('No hotel bookings yet.');
    const s = describeProductBookings(
      [{ id: 'sbk_1', reference: 'ABC', accommodationName: 'The Grand', amount: '220.00', currency: 'USD' }],
      'hotel',
    );
    expect(s).toContain('sbk_1');
    expect(s).toContain('The Grand');
  });
});
