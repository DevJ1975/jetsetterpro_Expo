import { cToF, fetchWeather, geocodeCity } from '@/src/core/api/weather';

const okJson = (body: unknown) => ({ ok: true, json: async () => body });

describe('cToF', () => {
  it('converts and rounds celsius to fahrenheit', () => {
    expect(cToF(0)).toBe(32);
    expect(cToF(100)).toBe(212);
    expect(cToF(37)).toBe(99); // 98.6 → 99
    expect(cToF(-40)).toBe(-40);
  });
});

describe('geocodeCity', () => {
  afterEach(() => jest.restoreAllMocks());

  it('returns the first result lat/lon', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(okJson({ results: [{ latitude: 48.85, longitude: 2.35 }] })) as never;
    await expect(geocodeCity('Paris')).resolves.toEqual({ lat: 48.85, lon: 2.35 });
  });

  it('strips everything after the first comma before querying', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(okJson({ results: [{ latitude: 1, longitude: 2 }] }));
    globalThis.fetch = fetchMock as never;
    await geocodeCity('Tokyo, Japan');
    expect(String(fetchMock.mock.calls[0][0])).toContain('name=Tokyo');
    expect(String(fetchMock.mock.calls[0][0])).not.toContain('Japan');
  });

  it('returns null when there are no results', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue(okJson({ results: [] })) as never;
    await expect(geocodeCity('Nowherecity')).resolves.toBeNull();
  });

  it('returns null on an HTTP error', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: false, json: async () => ({}) }) as never;
    await expect(geocodeCity('Paris')).resolves.toBeNull();
  });
});

describe('fetchWeather', () => {
  afterEach(() => jest.restoreAllMocks());

  it('geocodes then maps the current weather with a WMO description', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValueOnce(okJson({ results: [{ latitude: 48.85, longitude: 2.35 }] }))
      .mockResolvedValueOnce(okJson({ current: { temperature_2m: 21, weather_code: 3 } })) as never;
    await expect(fetchWeather('Paris')).resolves.toEqual({
      tempC: 21,
      code: 3,
      description: 'Overcast',
    });
  });

  it('uses an em-dash for an unknown WMO code', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValueOnce(okJson({ results: [{ latitude: 1, longitude: 2 }] }))
      .mockResolvedValueOnce(okJson({ current: { temperature_2m: 10, weather_code: 7777 } })) as never;
    await expect(fetchWeather('Paris')).resolves.toMatchObject({ description: '—' });
  });

  it('returns null when the city cannot be geocoded', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue(okJson({ results: [] })) as never;
    await expect(fetchWeather('Nowherecity')).resolves.toBeNull();
  });
});
