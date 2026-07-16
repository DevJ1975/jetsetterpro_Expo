import { useQuery } from '@tanstack/react-query';
import { authedGet, isBackendConfigured } from './backend';

// U.S. State Department travel advisories (Level 1–4) via the `stateDept` Cloud
// Function (CC-BY data, cached server-side and shared across all users). The
// source attribution must be shown wherever the advisory is displayed.

export type AdvisoryLevel = 1 | 2 | 3 | 4;

export interface TravelAdvisory {
  country: string; // ISO2
  level: AdvisoryLevel;
  label: string; // e.g. "Exercise Increased Caution"
  headline: string;
  url: string; // official travel.state.gov page for full detail
  updated: string | null;
  source: string; // CC-BY attribution — display this
}

/** Badge tone for an advisory level (matches the app's status tones). */
export function advisoryTone(level: number): 'good' | 'warn' | 'bad' {
  if (level >= 3) return 'bad'; // Reconsider Travel / Do Not Travel
  if (level === 2) return 'warn';
  return 'good';
}

export async function fetchTravelAdvisory(
  country: string,
  name: string,
): Promise<TravelAdvisory | null> {
  const { advisory } = await authedGet<{ advisory: TravelAdvisory | null }>('stateDept', {
    op: 'advisory',
    country,
    name,
  });
  return advisory;
}

/**
 * Travel advisory for a country (by ISO2 + name for matching). Advisories change
 * slowly so this caches generously; when the backend is unconfigured, the
 * endpoint errors, or the country isn't listed, `data` is null/undefined and the
 * UI simply hides the advisory card.
 */
export function useTravelAdvisory(country?: string | null, name?: string | null) {
  return useQuery({
    queryKey: ['advisory', country],
    queryFn: () => fetchTravelAdvisory(country as string, (name as string) ?? ''),
    enabled: Boolean(country) && isBackendConfigured(),
    staleTime: 12 * 3600_000,
    gcTime: 24 * 3600_000,
    retry: 1,
  });
}
