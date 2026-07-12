import { Platform } from 'react-native';

// JS bridge to the native Flight Live Activity (iOS 16.1+ ActivityKit, rendered
// by the `flight-activity` widget target). The native module is present only in
// a development/production build with the target compiled; everywhere else
// (Expo Go, Android, web) this degrades to a no-op so callers never crash.
//
// Content mirrors the iOS FlightActivityAttributes.ContentState so the same
// widget UI drives both apps.

export interface FlightActivityContent {
  flightNumber: string;
  origin: string;
  destination: string;
  status: string; // 'On Time' | 'Delayed' | 'Boarding' | 'Departed' | 'Landed'
  gate?: string;
  departISO?: string;
  arriveISO?: string;
  progress: number; // 0..1
}

interface NativeLiveActivity {
  areActivitiesEnabled(): boolean;
  startActivity(content: FlightActivityContent): Promise<string>;
  updateActivity(id: string, content: FlightActivityContent): Promise<void>;
  endActivity(id: string): Promise<void>;
}

function loadNative(): NativeLiveActivity | null {
  if (Platform.OS !== 'ios') return null;
  try {
    // The native module is registered by the widget target's config plugin. It
    // is intentionally optional — absent in Expo Go and pre-prebuild.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('../../../modules/flight-live-activity');
    return (mod?.default ?? mod) as NativeLiveActivity;
  } catch {
    return null;
  }
}

const native = loadNative();

export const FlightLiveActivity = {
  isSupported(): boolean {
    try {
      return !!native && native.areActivitiesEnabled();
    } catch {
      return false;
    }
  },
  async start(content: FlightActivityContent): Promise<string | null> {
    if (!native) return null;
    try {
      return await native.startActivity(content);
    } catch {
      return null;
    }
  },
  async update(id: string, content: FlightActivityContent): Promise<void> {
    if (!native) return;
    try {
      await native.updateActivity(id, content);
    } catch {
      /* best-effort */
    }
  },
  async end(id: string): Promise<void> {
    if (!native) return;
    try {
      await native.endActivity(id);
    } catch {
      /* best-effort */
    }
  },
};
