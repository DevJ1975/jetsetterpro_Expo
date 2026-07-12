// open.er-api.com — no API key required (kept a direct client call, like iOS).

const cache = new Map<string, { at: number; rates: Record<string, number> }>();
const TTL = 60 * 60 * 1000;

async function ratesFor(base: string): Promise<Record<string, number> | null> {
  const key = base.toUpperCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.rates;
  try {
    const r = await fetch(`https://open.er-api.com/v6/latest/${key}`);
    if (!r.ok) return null;
    const j = (await r.json()) as { result?: string; rates?: Record<string, number> };
    if (j.result !== 'success' || !j.rates) return null;
    cache.set(key, { at: Date.now(), rates: j.rates });
    return j.rates;
  } catch {
    return null;
  }
}

export async function convertCurrency(
  amount: number,
  from: string,
  to: string,
): Promise<{ converted: number; rate: number } | null> {
  const rates = await ratesFor(from);
  const rate = rates?.[to.toUpperCase()];
  if (rate == null) return null;
  return { converted: amount * rate, rate };
}
