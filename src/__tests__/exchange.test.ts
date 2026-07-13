// exchange.ts keeps a module-level rate cache, so reset the module registry
// before each test to get a clean cache and re-import the fresh instance.
const okRates = (rates: Record<string, number>) => ({
  ok: true,
  json: async () => ({ result: 'success', rates }),
});

function load() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@/src/core/api/exchange') as typeof import('@/src/core/api/exchange');
}

beforeEach(() => {
  jest.resetModules();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('convertCurrency', () => {
  it('converts using the fetched rate', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue(okRates({ EUR: 0.9, GBP: 0.8 })) as never;
    const { convertCurrency } = load();
    await expect(convertCurrency(100, 'USD', 'EUR')).resolves.toEqual({
      converted: 90,
      rate: 0.9,
    });
  });

  it('is case-insensitive on the target code', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue(okRates({ JPY: 150 })) as never;
    const { convertCurrency } = load();
    await expect(convertCurrency(2, 'usd', 'jpy')).resolves.toEqual({
      converted: 300,
      rate: 150,
    });
  });

  it('returns null when the target currency is missing from the rate table', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue(okRates({ EUR: 0.9 })) as never;
    const { convertCurrency } = load();
    await expect(convertCurrency(100, 'USD', 'XYZ')).resolves.toBeNull();
  });

  it('returns null on an HTTP error', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: false, json: async () => ({}) }) as never;
    const { convertCurrency } = load();
    await expect(convertCurrency(100, 'USD', 'EUR')).resolves.toBeNull();
  });

  it('returns null when the API reports a non-success result', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ result: 'error' }) }) as never;
    const { convertCurrency } = load();
    await expect(convertCurrency(100, 'USD', 'EUR')).resolves.toBeNull();
  });

  it('caches rates per base currency (second lookup does not refetch)', async () => {
    const fetchMock = jest.fn().mockResolvedValue(okRates({ EUR: 0.9, GBP: 0.8 }));
    globalThis.fetch = fetchMock as never;
    const { convertCurrency } = load();
    await convertCurrency(100, 'USD', 'EUR');
    await convertCurrency(50, 'USD', 'GBP');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns null and does not throw when fetch rejects', async () => {
    globalThis.fetch = jest.fn().mockRejectedValue(new Error('network down')) as never;
    const { convertCurrency } = load();
    await expect(convertCurrency(100, 'USD', 'EUR')).resolves.toBeNull();
  });
});
