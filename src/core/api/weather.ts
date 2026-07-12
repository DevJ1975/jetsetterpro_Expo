import { useQuery } from '@tanstack/react-query';

// Open-Meteo — no API key required (kept a direct client call, like iOS).

export interface Weather {
  tempC: number;
  code: number;
  description: string;
}

const WMO: Record<number, string> = {
  0: 'Clear',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Rime fog',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Heavy drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  71: 'Light snow',
  73: 'Snow',
  75: 'Heavy snow',
  80: 'Showers',
  81: 'Showers',
  82: 'Violent showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm',
  99: 'Thunderstorm',
};

async function geocode(city: string): Promise<{ lat: number; lon: number } | null> {
  const q = city.split(',')[0].trim();
  const r = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1`,
  );
  if (!r.ok) return null;
  const j = (await r.json()) as { results?: { latitude: number; longitude: number }[] };
  const g = j.results?.[0];
  return g ? { lat: g.latitude, lon: g.longitude } : null;
}

export async function fetchWeather(city: string): Promise<Weather | null> {
  const g = await geocode(city);
  if (!g) return null;
  const r = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${g.lat}&longitude=${g.lon}&current=temperature_2m,weather_code`,
  );
  if (!r.ok) return null;
  const j = (await r.json()) as { current?: { temperature_2m: number; weather_code: number } };
  if (!j.current) return null;
  return {
    tempC: j.current.temperature_2m,
    code: j.current.weather_code,
    description: WMO[j.current.weather_code] ?? '—',
  };
}

export function useWeather(city?: string) {
  return useQuery({
    queryKey: ['weather', city],
    queryFn: () => fetchWeather(city as string),
    enabled: !!city,
  });
}

export const cToF = (c: number) => Math.round((c * 9) / 5 + 32);
