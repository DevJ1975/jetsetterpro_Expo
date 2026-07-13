/* eslint-disable import/first -- jest.mock() must be hoisted above the imports it mocks */
// wallet.ts creates a persisted zustand store on import → mock AsyncStorage.
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
    removeItem: jest.fn(async () => undefined),
  },
}));

import { passesFromTrips } from '@/src/core/store/wallet';
import { makeFlight, makeTrip } from './_fixtures';

describe('passesFromTrips', () => {
  it('derives passes for flight/hotel/car and skips activity/restaurant/other', () => {
    const trip = makeTrip({
      name: 'Trip A',
      items: [
        makeFlight({ id: 'f1', type: 'flight', title: 'AA1', confirmation: 'ABC', startDate: '2026-08-01T09:00:00.000Z', location: 'JFK' }),
        makeFlight({ id: 'h1', type: 'hotel', title: 'Hotel' }),
        makeFlight({ id: 'c1', type: 'car', title: 'Car' }),
        makeFlight({ id: 'a1', type: 'activity', title: 'Tour' }),
        makeFlight({ id: 'r1', type: 'restaurant', title: 'Dinner' }),
      ],
    });
    const passes = passesFromTrips([trip]);
    expect(passes.map((p) => p.kind)).toEqual(['boardingPass', 'hotel', 'car']);

    const flightPass = passes[0];
    expect(flightPass.id).toBe('derived-f1');
    expect(flightPass.title).toBe('AA1');
    expect(flightPass.subtitle).toBe('Trip A');
    expect(flightPass.code).toBe('ABC');
    expect(flightPass.date).toBe('2026-08-01T09:00:00.000Z');
    expect(flightPass.location).toBe('JFK');
  });

  it('returns [] for no trips or only unmappable items', () => {
    expect(passesFromTrips([])).toEqual([]);
    expect(passesFromTrips([makeTrip({ items: [makeFlight({ type: 'activity' })] })])).toEqual([]);
  });
});
