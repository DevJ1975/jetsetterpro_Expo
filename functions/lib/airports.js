// Static IATA → { lat, lng } lookup for major commercial airports, so the
// drive-time function can resolve a departure airport to coordinates offline
// and free (no geocoding API call). This is a curated set of busy hubs, not the
// full ~9,000-airport database — expand as needed. Coordinates are the airport
// reference point (deg).
const AIRPORTS = {
  ATL: [33.6407, -84.4277], DFW: [32.8998, -97.0403], DEN: [39.8561, -104.6737],
  ORD: [41.9742, -87.9073], LAX: [33.9416, -118.4085], JFK: [40.6413, -73.7781],
  LAS: [36.084, -115.1537], MCO: [28.4312, -81.3081], MIA: [25.7959, -80.287],
  CLT: [35.214, -80.9431], SEA: [47.4502, -122.3088], EWR: [40.6895, -74.1745],
  SFO: [37.6213, -122.379], PHX: [33.4342, -112.0116], IAH: [29.9902, -95.3368],
  BOS: [42.3656, -71.0096], FLL: [26.0742, -80.1506], MSP: [44.8848, -93.2223],
  LGA: [40.7769, -73.874], DTW: [42.2162, -83.3554], PHL: [39.8744, -75.2424],
  SLC: [40.7899, -111.9791], DCA: [38.8512, -77.0402], SAN: [32.7338, -117.1933],
  BWI: [39.1774, -76.6684], TPA: [27.9755, -82.5332], AUS: [30.1975, -97.6664],
  IAD: [38.9531, -77.4565], BNA: [36.1263, -86.6774], MDW: [41.786, -87.7524],
  HNL: [21.3187, -157.9225], PDX: [45.5898, -122.5951], STL: [38.7487, -90.37],
  RDU: [35.8801, -78.7875], HOU: [29.6454, -95.2789], SMF: [38.6954, -121.5908],
  MSY: [29.9934, -90.258], SJC: [37.3639, -121.9289], SNA: [33.6757, -117.8682],
  DAL: [32.8471, -96.8518], OAK: [37.7213, -122.2207], MCI: [39.2976, -94.7139],
  // International hubs
  LHR: [51.47, -0.4543], CDG: [49.0097, 2.5479], AMS: [52.3105, 4.7683],
  FRA: [50.0379, 8.5622], MAD: [40.4839, -3.568], BCN: [41.2974, 2.0833],
  FCO: [41.8003, 12.2389], IST: [41.2753, 28.7519], DXB: [25.2532, 55.3657],
  DOH: [25.2731, 51.6081], SIN: [1.3644, 103.9915], HKG: [22.308, 113.9185],
  NRT: [35.772, 140.3929], HND: [35.5494, 139.7798], ICN: [37.4602, 126.4407],
  SYD: [-33.9399, 151.1753], MEX: [19.4363, -99.0721], GRU: [-23.4356, -46.4731],
  YYZ: [43.6777, -79.6248], YVR: [49.1967, -123.1815], LGW: [51.1537, -0.1821],
  MUC: [48.3538, 11.7861], ZRH: [47.4582, 8.5556], DUB: [53.4213, -6.2701],
  CUN: [21.0365, -86.877], NRT2: [35.772, 140.3929],
};

/** Resolve an IATA code (case-insensitive) to [lat, lng], or null if unknown. */
function airportCoords(iata) {
  if (!iata || typeof iata !== 'string') return null;
  const c = AIRPORTS[iata.trim().toUpperCase()];
  return c ? { latitude: c[0], longitude: c[1] } : null;
}

module.exports = { airportCoords, AIRPORTS };
