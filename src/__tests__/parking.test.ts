/* eslint-disable import/first -- jest.mock() must be hoisted above the imports it mocks */
// parking.ts creates a persisted zustand store on import → mock AsyncStorage.
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
    removeItem: jest.fn(async () => undefined),
  },
}));

import { useParking, type ParkingSpot } from '@/src/core/store/parking';

// The parking store holds a single active spot: setSpot replaces it, clear
// removes it (the "found my car" reset).
describe('parking store', () => {
  beforeEach(() => {
    useParking.setState({ spot: undefined });
  });

  it('saves and clears the active spot', () => {
    const spot: ParkingSpot = {
      id: 'p1',
      level: 'Level 3',
      section: 'Blue',
      spot: 'H-14',
      coords: { latitude: 40.6413, longitude: -73.7781 },
      createdAt: '2026-07-16T10:00:00.000Z',
    };
    useParking.getState().setSpot(spot);
    expect(useParking.getState().spot).toEqual(spot);

    useParking.getState().clear();
    expect(useParking.getState().spot).toBeUndefined();
  });

  it('replaces the spot on a second save (single active spot, no history)', () => {
    useParking.getState().setSpot({ id: 'a', level: '1', createdAt: 't1' });
    useParking.getState().setSpot({ id: 'b', level: '2', createdAt: 't2' });
    expect(useParking.getState().spot?.id).toBe('b');
  });
});
