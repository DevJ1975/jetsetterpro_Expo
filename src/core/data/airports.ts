// Airport coordinates for the world's busiest hubs — ported 1:1 from the iOS
// `AirportCoordinates.swift` table. Drives great-circle routes on flight maps,
// the carbon calculator, and airport-map centering.

export interface AirportCoord {
  lat: number;
  lon: number;
}

export const AIRPORT_COORDS: Record<string, AirportCoord> = {
  ATL: { lat: 33.6407, lon: -84.4277 },
  BOS: { lat: 42.3656, lon: -71.0096 },
  BWI: { lat: 39.1754, lon: -76.6683 },
  CLT: { lat: 35.2144, lon: -80.9473 },
  DCA: { lat: 38.8512, lon: -77.0402 },
  DEN: { lat: 39.8561, lon: -104.6737 },
  DFW: { lat: 32.8998, lon: -97.0403 },
  DTW: { lat: 42.2124, lon: -83.3534 },
  EWR: { lat: 40.6925, lon: -74.1687 },
  FLL: { lat: 26.0742, lon: -80.1506 },
  HNL: { lat: 21.3187, lon: -157.9225 },
  IAD: { lat: 38.9531, lon: -77.4565 },
  IAH: { lat: 29.9844, lon: -95.3414 },
  JFK: { lat: 40.6413, lon: -73.7781 },
  LAS: { lat: 36.0840, lon: -115.1537 },
  LAX: { lat: 33.9416, lon: -118.4085 },
  LGA: { lat: 40.7769, lon: -73.8740 },
  MCO: { lat: 28.4312, lon: -81.3081 },
  MIA: { lat: 25.7959, lon: -80.2870 },
  MSP: { lat: 44.8848, lon: -93.2223 },
  ORD: { lat: 41.9742, lon: -87.9073 },
  PHL: { lat: 39.8744, lon: -75.2424 },
  PHX: { lat: 33.4373, lon: -112.0078 },
  SAN: { lat: 32.7338, lon: -117.1933 },
  SEA: { lat: 47.4502, lon: -122.3088 },
  SFO: { lat: 37.6213, lon: -122.3790 },
  SLC: { lat: 40.7899, lon: -111.9791 },
  MEX: { lat: 19.4361, lon: -99.0719 },
  YUL: { lat: 45.4706, lon: -73.7408 },
  YVR: { lat: 49.1967, lon: -123.1815 },
  YYC: { lat: 51.1215, lon: -114.0067 },
  YYZ: { lat: 43.6772, lon: -79.6306 },
  BOG: { lat: 4.7016, lon: -74.1469 },
  EZE: { lat: -34.8222, lon: -58.5358 },
  GRU: { lat: -23.4356, lon: -46.4731 },
  LIM: { lat: -12.0219, lon: -77.1143 },
  SCL: { lat: -33.3930, lon: -70.7858 },
  AMS: { lat: 52.3105, lon: 4.7683 },
  ARN: { lat: 59.6498, lon: 17.9237 },
  ATH: { lat: 37.9364, lon: 23.9445 },
  BCN: { lat: 41.2974, lon: 2.0833 },
  BER: { lat: 52.3667, lon: 13.5033 },
  CDG: { lat: 49.0097, lon: 2.5479 },
  CPH: { lat: 55.6181, lon: 12.6561 },
  DUB: { lat: 53.4264, lon: -6.2499 },
  FCO: { lat: 41.7999, lon: 12.2462 },
  FRA: { lat: 50.0379, lon: 8.5622 },
  HEL: { lat: 60.3172, lon: 24.9633 },
  IST: { lat: 41.2753, lon: 28.7519 },
  LGW: { lat: 51.1537, lon: -0.1821 },
  LHR: { lat: 51.4700, lon: -0.4543 },
  LIS: { lat: 38.7742, lon: -9.1342 },
  MAD: { lat: 40.4936, lon: -3.5668 },
  MUC: { lat: 48.3538, lon: 11.7861 },
  MXP: { lat: 45.6306, lon: 8.7281 },
  ORY: { lat: 48.7233, lon: 2.3794 },
  OSL: { lat: 60.1976, lon: 11.1004 },
  VIE: { lat: 48.1103, lon: 16.5697 },
  ZRH: { lat: 47.4647, lon: 8.5492 },
  AUH: { lat: 24.4441, lon: 54.6510 },
  CAI: { lat: 30.1219, lon: 31.4056 },
  CPT: { lat: -33.9648, lon: 18.6017 },
  DOH: { lat: 25.2731, lon: 51.6080 },
  DXB: { lat: 25.2528, lon: 55.3644 },
  JNB: { lat: -26.1392, lon: 28.2460 },
  BKK: { lat: 13.6900, lon: 100.7501 },
  CAN: { lat: 23.3924, lon: 113.2988 },
  DEL: { lat: 28.5562, lon: 77.1000 },
  HAN: { lat: 21.2187, lon: 105.8042 },
  HKG: { lat: 22.3080, lon: 113.9185 },
  HND: { lat: 35.5494, lon: 139.7798 },
  ICN: { lat: 37.4602, lon: 126.4407 },
  KIX: { lat: 34.4347, lon: 135.2440 },
  KUL: { lat: 2.7456, lon: 101.7099 },
  MNL: { lat: 14.5086, lon: 121.0194 },
  NRT: { lat: 35.7720, lon: 140.3929 },
  PEK: { lat: 40.0801, lon: 116.5846 },
  PVG: { lat: 31.1443, lon: 121.8083 },
  SGN: { lat: 10.8188, lon: 106.6520 },
  SIN: { lat: 1.3644, lon: 103.9915 },
  TPE: { lat: 25.0797, lon: 121.2342 },
  BOM: { lat: 19.0896, lon: 72.8656 },
  AKL: { lat: -37.0082, lon: 174.7850 },
  BNE: { lat: -27.3838, lon: 153.1180 },
  MEL: { lat: -37.6733, lon: 144.8430 },
  PER: { lat: -31.9402, lon: 115.9667 },
  SYD: { lat: -33.9399, lon: 151.1753 },
};

export function airportCoord(iata: string): AirportCoord | null {
  return AIRPORT_COORDS[iata.toUpperCase()] ?? null;
}

const EARTH_RADIUS_KM = 6371;

/** Great-circle distance between two airports, in km (null if either unknown). */
export function greatCircleKm(fromIata: string, toIata: string): number | null {
  const a = airportCoord(fromIata);
  const b = airportCoord(toIata);
  if (!a || !b) return null;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(s)));
}

/** N points along the great-circle path (for map polylines). */
export function greatCirclePath(
  fromIata: string,
  toIata: string,
  points = 32,
): { latitude: number; longitude: number }[] {
  const a = airportCoord(fromIata);
  const b = airportCoord(toIata);
  if (!a || !b) return [];
  const rad = (d: number) => (d * Math.PI) / 180;
  const deg = (r: number) => (r * 180) / Math.PI;
  const lat1 = rad(a.lat);
  const lon1 = rad(a.lon);
  const lat2 = rad(b.lat);
  const lon2 = rad(b.lon);
  const d =
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin((lat2 - lat1) / 2) ** 2 +
          Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2,
      ),
    );
  if (d === 0) return [{ latitude: a.lat, longitude: a.lon }];
  const out: { latitude: number; longitude: number }[] = [];
  for (let i = 0; i <= points; i += 1) {
    const f = i / points;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
    const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
    const z = A * Math.sin(lat1) + B * Math.sin(lat2);
    out.push({ latitude: deg(Math.atan2(z, Math.sqrt(x * x + y * y))), longitude: deg(Math.atan2(y, x)) });
  }
  return out;
}
