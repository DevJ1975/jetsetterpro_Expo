import { activeOrNextTrip, nextUpcomingFlight } from '@/src/core/store/travelSelectors';
import { makeFlight, makeTrip } from './_fixtures';

const NOW = new Date('2026-08-03T12:00:00.000Z');

describe('activeOrNextTrip', () => {
  it('returns the trip whose range contains today', () => {
    const active = makeTrip({ name: 'Active', startDate: '2026-08-01', endDate: '2026-08-05' });
    const future = makeTrip({ name: 'Future', startDate: '2026-09-01', endDate: '2026-09-05' });
    expect(activeOrNextTrip([future, active], NOW)?.name).toBe('Active');
  });

  it('returns the soonest upcoming trip when none is active', () => {
    const soon = makeTrip({ name: 'Soon', startDate: '2026-08-10', endDate: '2026-08-12' });
    const later = makeTrip({ name: 'Later', startDate: '2026-12-01', endDate: '2026-12-05' });
    expect(activeOrNextTrip([later, soon], NOW)?.name).toBe('Soon');
  });

  it('ignores fully-past trips', () => {
    const past = makeTrip({ name: 'Past', startDate: '2026-01-01', endDate: '2026-01-05' });
    expect(activeOrNextTrip([past], NOW)).toBeUndefined();
  });

  it('returns undefined for no trips', () => {
    expect(activeOrNextTrip([], NOW)).toBeUndefined();
  });
});

describe('nextUpcomingFlight', () => {
  it('returns the earliest future flight across trips', () => {
    const t1 = makeTrip({
      items: [makeFlight({ title: 'Later', startDate: '2026-08-20T09:00:00.000Z' })],
    });
    const t2 = makeTrip({
      items: [makeFlight({ title: 'Sooner', startDate: '2026-08-05T09:00:00.000Z' })],
    });
    expect(nextUpcomingFlight([t1, t2], NOW)?.item.title).toBe('Sooner');
  });

  it('ignores past flights and non-flight items', () => {
    const t = makeTrip({
      items: [
        makeFlight({ title: 'Past flight', startDate: '2026-07-01T09:00:00.000Z' }),
        makeFlight({ type: 'hotel', title: 'Hotel', startDate: '2026-08-10T09:00:00.000Z' }),
        makeFlight({ title: 'Future flight', startDate: '2026-08-10T09:00:00.000Z' }),
      ],
    });
    const next = nextUpcomingFlight([t], NOW);
    expect(next?.item.title).toBe('Future flight');
  });

  it('returns undefined when there are no future flights', () => {
    const t = makeTrip({
      items: [makeFlight({ startDate: '2026-07-01T09:00:00.000Z' })],
    });
    expect(nextUpcomingFlight([t], NOW)).toBeUndefined();
  });
});
