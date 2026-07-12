import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { zustandStorage } from '@/src/core/persistence/kv';

// Check-in state, keyed by the stable itinerary item id (NOT a parsed flight
// number — distinct flights without a parseable number would otherwise collide
// on a shared key). Records the chosen seat and any Live Activity id so the
// boarding pass and the activity lifecycle survive a remount.

export interface CheckInRecord {
  seat?: string;
  ts: string; // ISO timestamp of check-in
  activityId?: string; // Live Activity id, if one was started
}

interface CheckInState {
  checkedIn: Record<string, CheckInRecord>; // itemId → record
  markCheckedIn: (itemId: string, info?: { seat?: string; activityId?: string }) => void;
  isCheckedIn: (itemId: string) => boolean;
  getCheckIn: (itemId: string) => CheckInRecord | undefined;
}

export const useCheckIn = create<CheckInState>()(
  persist(
    (set, get) => ({
      checkedIn: {},
      markCheckedIn: (itemId, info) =>
        set({
          checkedIn: {
            ...get().checkedIn,
            [itemId]: { ...get().checkedIn[itemId], ts: new Date().toISOString(), ...info },
          },
        }),
      isCheckedIn: (itemId) => !!get().checkedIn[itemId],
      getCheckIn: (itemId) => get().checkedIn[itemId],
    }),
    { name: 'jetsetter_checked_in_flights', storage: zustandStorage },
  ),
);
