import { requireOptionalNativeModule } from 'expo-modules-core';

// Optional resolution: returns null in Expo Go / before prebuild / on Android,
// so importing this module never throws. The native implementation lives in
// ios/FlightLiveActivityModule.swift and is compiled by a development build.
const Native = requireOptionalNativeModule('FlightLiveActivity');

export interface FlightActivityContent {
  flightNumber: string;
  airlineName?: string;
  origin: string;
  destination: string;
  status: string;
  gate?: string;
  terminal?: string;
  departISO?: string;
  arriveISO?: string;
  progress: number;
}

export function areActivitiesEnabled(): boolean {
  try {
    return Native?.areActivitiesEnabled?.() ?? false;
  } catch {
    return false;
  }
}

export async function startActivity(content: FlightActivityContent): Promise<string> {
  if (!Native) throw new Error('FlightLiveActivity native module unavailable');
  return Native.startActivity(content);
}

export async function updateActivity(id: string, content: FlightActivityContent): Promise<void> {
  if (!Native) return;
  return Native.updateActivity(id, content);
}

export async function endActivity(id: string): Promise<void> {
  if (!Native) return;
  return Native.endActivity(id);
}

export default { areActivitiesEnabled, startActivity, updateActivity, endActivity };
