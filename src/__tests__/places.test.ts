/* eslint-disable import/first -- jest.mock() must be hoisted above the imports it mocks */
// geocodeCity is mocked so fetchPlaces resolves to a fixed origin (0,0).
jest.mock('@/src/core/api/weather', () => ({
  geocodeCity: jest.fn(async () => ({ lat: 0, lon: 0 })),
}));

import { fetchPlaces, formatDistance } from '@/src/core/api/places';

describe('formatDistance', () => {
  it('shows metres under 1 km and km at/above 1 km', () => {
    expect(formatDistance(0)).toBe('0 m');
    expect(formatDistance(999)).toBe('999 m');
    expect(formatDistance(1000)).toBe('1.0 km');
    expect(formatDistance(2500)).toBe('2.5 km');
    expect(formatDistance(12345)).toBe('12.3 km');
  });
});

describe('fetchPlaces', () => {
  afterEach(() => jest.restoreAllMocks());

  it('returns [] when the city cannot be geocoded', async () => {
    const weather = jest.requireMock('@/src/core/api/weather') as { geocodeCity: jest.Mock };
    weather.geocodeCity.mockResolvedValueOnce(null);
    await expect(fetchPlaces('Nowhere', 'cafes')).resolves.toEqual([]);
  });

  it('keeps the NEAREST of two same-named places (regression: dedup after distance sort)', async () => {
    const elements = [
      { id: 1, lat: 0.01, lon: 0.01, tags: { name: 'Starbucks', amenity: 'cafe' } }, // ~1.5 km (far)
      { id: 2, lat: 0.0001, lon: 0.0001, tags: { name: 'Starbucks', amenity: 'cafe' } }, // ~16 m (near)
    ];
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ elements }) }) as never;

    const places = await fetchPlaces('Anywhere', 'cafes');
    expect(places).toHaveLength(1);
    expect(places[0].id).toBe('2'); // the nearer branch survived dedup
  });

  it('throws on a non-ok Overpass response', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: false, status: 504 }) as never;
    await expect(fetchPlaces('Anywhere', 'cafes')).rejects.toThrow('Overpass 504');
  });
});
