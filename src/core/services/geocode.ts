import * as Location from 'expo-location';

// Forward-geocode a place name to coordinates for Duffel Stays/Cars search
// (which take lat/long, not a city string). Forward geocoding is an address
// lookup and doesn't require location permission. Returns null on failure so
// callers degrade gracefully.
export async function geocodePlace(
  place: string,
): Promise<{ latitude: number; longitude: number } | null> {
  const q = place.trim();
  if (!q) return null;
  try {
    const res = await Location.geocodeAsync(q);
    if (res && res[0]) return { latitude: res[0].latitude, longitude: res[0].longitude };
  } catch {
    /* offline or unsupported — caller handles null */
  }
  return null;
}
