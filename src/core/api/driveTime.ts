import { useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { authedPost, isBackendConfigured } from './backend';

// Live traffic-aware drive time from the traveler's current location to their
// departure airport, via the `driveTime` Cloud Function (Google Routes). Used to
// make the home "leave by" strip reflect real traffic. Non-intrusive: it uses
// the LAST KNOWN position only (never prompts), so it silently no-ops until the
// user has granted location elsewhere and a fix is cached — the strip then falls
// back to its static drive estimate.

export interface DriveTime {
  durationMin: number;
  staticDurationMin: number;
  distanceKm: number;
}

export async function fetchDriveTime(params: {
  originLat: number;
  originLng: number;
  airport?: string;
  destLat?: number;
  destLng?: number;
}): Promise<DriveTime> {
  return authedPost<DriveTime>('driveTime', params);
}

/**
 * Live drive time to `airport` (IATA) from the last known device location.
 * Returns undefined `data` when the backend/location aren't available; callers
 * fall back to their heuristic.
 */
export function useLiveDriveTime(airport?: string | null) {
  return useQuery({
    queryKey: ['driveTime', airport],
    enabled: Boolean(airport) && isBackendConfigured(),
    staleTime: 3 * 60_000, // traffic shifts; refresh a few minutes out
    gcTime: 10 * 60_000,
    retry: 0,
    queryFn: async (): Promise<DriveTime | null> => {
      // Never prompt — only use a cached fix the user already granted.
      const pos = await Location.getLastKnownPositionAsync().catch(() => null);
      if (!pos) return null;
      return fetchDriveTime({
        originLat: pos.coords.latitude,
        originLng: pos.coords.longitude,
        airport: airport as string,
      });
    },
  });
}
