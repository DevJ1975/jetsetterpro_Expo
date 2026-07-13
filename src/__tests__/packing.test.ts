import { generatePackingList } from '@/src/features/packing/generate';
import type { PackingItem } from '@/src/types/models';
import { makeTrip } from './_fixtures';

const labels = (items: PackingItem[]) => items.map((i) => i.label);

describe('generatePackingList', () => {
  it('scales clothing counts by trip length (nights + 1 underwear/socks)', () => {
    // 2026-08-01 → 2026-08-05 = 4 nights.
    const list = generatePackingList(makeTrip({ startDate: '2026-08-01', endDate: '2026-08-05' }));
    expect(labels(list)).toContain('5 × underwear');
    expect(labels(list)).toContain('5 × socks');
    expect(labels(list)).toContain('3 × shirts'); // max(2, ceil(4 * 0.75)) = max(2, 3) = 3
  });

  it('computes shirts as max(2, ceil(nights*0.75)) and pants as max(1, ceil(nights/3))', () => {
    const list = generatePackingList(makeTrip({ startDate: '2026-08-01', endDate: '2026-08-07' })); // 6 nights
    const l = labels(list);
    expect(l).toContain(`${Math.max(2, Math.ceil(6 * 0.75))} × shirts`); // 5 shirts
    expect(l).toContain(`${Math.max(1, Math.ceil(6 / 3))} × pants`); // 2 pants
  });

  it('enforces a minimum of 1 night for a same-day trip', () => {
    const list = generatePackingList(makeTrip({ startDate: '2026-08-01', endDate: '2026-08-01' }));
    expect(labels(list)).toContain('2 × underwear'); // nights=1 → 1+1
    expect(labels(list)).toContain('2 × shirts'); // max(2, ceil(0.75)) = 2
    expect(labels(list)).toContain('1 × pants');
  });

  it('suggests extra shoes only for trips of 4+ nights', () => {
    const short = generatePackingList(makeTrip({ startDate: '2026-08-01', endDate: '2026-08-03' })); // 2 nights
    const long = generatePackingList(makeTrip({ startDate: '2026-08-01', endDate: '2026-08-06' })); // 5 nights
    expect(labels(short)).toContain('Comfortable shoes');
    expect(labels(short)).not.toContain('Extra shoes');
    expect(labels(long)).toContain('Extra shoes');
  });

  it('includes the fixed document/essentials/toiletries/electronics groups', () => {
    const list = generatePackingList(makeTrip());
    const l = labels(list);
    expect(l).toContain('Passport / ID');
    expect(l).toContain('Phone charger');
    expect(l).toContain('Toothbrush & paste');
    expect(l).toContain('Travel adapter');
    // Every item has a unique id and a category.
    expect(new Set(list.map((i) => i.id)).size).toBe(list.length);
    expect(list.every((i) => !!i.category)).toBe(true);
  });

  it('preserves prior check-offs by label when regenerating', () => {
    const trip = makeTrip();
    const first = generatePackingList(trip);
    const passport = first.find((i) => i.label === 'Passport / ID')!;
    const toggled = first.map((i) => (i.id === passport.id ? { ...i, packed: true } : i));

    const regenerated = generatePackingList(trip, toggled);
    expect(regenerated.find((i) => i.label === 'Passport / ID')!.packed).toBe(true);
    // Unrelated items stay unpacked.
    expect(regenerated.find((i) => i.label === 'Sunscreen')!.packed).toBe(false);
  });
});
