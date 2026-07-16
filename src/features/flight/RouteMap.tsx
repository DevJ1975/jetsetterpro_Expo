// Map card with the great-circle route between two airports — the RN port of
// iOS `FlightMapView.swift`. Dashed planned route, solid flown-path emphasis
// behind the plane, endpoint dots, and a heading-rotated plane marker. The
// plane anchors to a real coordinate (live GPS / API position) when provided,
// else to a time-interpolated `progress` along the route.

import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { greatCirclePath } from '@/src/core/data/airports';
import { palette, type } from '@/src/ui';

export interface PlaneFix {
  latitude: number;
  longitude: number;
  heading?: number | null;
}

interface LatLng {
  latitude: number;
  longitude: number;
}

/** Shift each longitude by ±360 where the path jumps across the antimeridian,
 *  so transpacific routes render as one continuous polyline. */
function unwrap(path: LatLng[]): LatLng[] {
  const out: LatLng[] = [];
  let offset = 0;
  for (let i = 0; i < path.length; i += 1) {
    let lon = path[i].longitude + offset;
    if (i > 0) {
      const prev = out[i - 1].longitude;
      if (lon - prev > 180) {
        offset -= 360;
        lon -= 360;
      } else if (prev - lon > 180) {
        offset += 360;
        lon += 360;
      }
    }
    out.push({ latitude: path[i].latitude, longitude: lon });
  }
  return out;
}

/** Bring `lon` into the same ±180° window as `ref`. */
function adjustLon(lon: number, ref: number): number {
  let l = lon;
  while (l - ref > 180) l -= 360;
  while (ref - l > 180) l += 360;
  return l;
}

function nearestIndex(path: LatLng[], p: LatLng): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < path.length; i += 1) {
    const dLat = path[i].latitude - p.latitude;
    const dLon = path[i].longitude - p.longitude;
    const d = dLat * dLat + dLon * dLon;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/** Bearing (degrees from north) of the route segment at `index`. */
function segmentBearing(path: LatLng[], index: number): number {
  const i = Math.max(0, Math.min(index, path.length - 2));
  const a = path[i];
  const b = path[i + 1];
  const deg = (Math.atan2(b.longitude - a.longitude, b.latitude - a.latitude) * 180) / Math.PI;
  return (deg + 360) % 360;
}

export function RouteMap({
  origin,
  destination,
  plane,
  progress,
  height = 220,
}: {
  origin: string;
  destination: string;
  /** Real coordinate for the plane (live GPS or API position). Wins over progress. */
  plane?: PlaneFix | null;
  /** 0–1 along the route — fallback plane anchor when no real fix exists. */
  progress?: number | null;
  height?: number;
}) {
  const path = useMemo(() => unwrap(greatCirclePath(origin, destination, 64)), [origin, destination]);

  const region = useMemo(() => {
    if (path.length < 2) return null;
    const lats = path.map((p) => p.latitude);
    const lons = path.map((p) => p.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLon + maxLon) / 2,
      latitudeDelta: Math.min(160, Math.max(2, (maxLat - minLat) * 1.3)),
      longitudeDelta: Math.max(2, (maxLon - minLon) * 1.3),
    };
  }, [path]);

  if (path.length < 2 || !region) {
    // Airport outside the bundled coordinate table — labeled placeholder
    // instead of a blank map (iOS falls back to its abstract animation).
    return (
      <View style={[styles.frame, styles.fallback, { height }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={type.heading}>{origin || '—'}</Text>
          <Ionicons name="airplane" size={20} color={palette.bright} />
          <Text style={type.heading}>{destination || '—'}</Text>
        </View>
        <Text style={[type.caption, { marginTop: 6 }]}>Route preview unavailable</Text>
      </View>
    );
  }

  // Resolve the plane anchor: real fix beats interpolated progress.
  let planePoint: LatLng | null = null;
  let planeHeading: number | null = null;
  if (plane) {
    planePoint = {
      latitude: plane.latitude,
      longitude: adjustLon(plane.longitude, region.longitude),
    };
    planeHeading = plane.heading ?? null;
  } else if (progress != null && Number.isFinite(progress)) {
    const idx = Math.round(Math.max(0, Math.min(1, progress)) * (path.length - 1));
    planePoint = path[idx];
  }
  const flownEnd = planePoint ? nearestIndex(path, planePoint) : 0;
  if (planePoint && planeHeading == null) planeHeading = segmentBearing(path, flownEnd);
  const flown = planePoint ? [...path.slice(0, flownEnd + 1), planePoint] : [];

  return (
    <View style={[styles.frame, { height }]}>
      <MapView
        key={`${origin}-${destination}`}
        style={StyleSheet.absoluteFill}
        initialRegion={region}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
        showsPointsOfInterests={false}
        userInterfaceStyle="dark"
      >
        {/* Planned route — dashed accent, like the iOS 2.5pt dashed stroke. */}
        <Polyline
          coordinates={path}
          strokeColor="rgba(59,158,240,0.7)"
          strokeWidth={2.5}
          lineDashPattern={[6, 4]}
        />
        {/* Flown-path emphasis — solid trail behind the plane. */}
        {flown.length > 1 ? (
          <Polyline coordinates={flown} strokeColor={palette.accent} strokeWidth={3} />
        ) : null}

        <Marker coordinate={path[0]} anchor={{ x: 0.5, y: 0.5 }}>
          <View style={[styles.dot, { backgroundColor: palette.accent }]} />
        </Marker>
        <Marker coordinate={path[path.length - 1]} anchor={{ x: 0.5, y: 0.5 }}>
          <View style={[styles.dot, { backgroundColor: palette.good }]} />
        </Marker>

        {planePoint ? (
          <Marker coordinate={planePoint} anchor={{ x: 0.5, y: 0.5 }} zIndex={10}>
            <View style={styles.plane}>
              {/* Ionicons airplane points east; headings measure from north. */}
              <View style={{ transform: [{ rotate: `${((planeHeading ?? 0) - 90 + 360) % 360}deg` }] }}>
                <Ionicons name="airplane" size={16} color="#FFFFFF" />
              </View>
            </View>
          </Marker>
        ) : null}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: palette.elevated2,
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  plane: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: palette.accent,
    shadowOpacity: 0.6,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
});
