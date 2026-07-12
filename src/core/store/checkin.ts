import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { zustandStorage } from '@/src/core/persistence/kv';

// Minimal check-in state (the RN analog of CheckInStateStore) — enough for IRIS's
// checkInForFlight tool and the check-in-window trigger. The full check-in flow
// (seat map → boarding pass + Live Activity) is ported in a later phase.

interface CheckInState {
  checkedIn: Record<string, string>; // flightNumber → ISO timestamp
  markCheckedIn: (flightNumber: string) => void;
  isCheckedIn: (flightNumber: string) => boolean;
}

export const useCheckIn = create<CheckInState>()(
  persist(
    (set, get) => ({
      checkedIn: {},
      markCheckedIn: (flightNumber) =>
        set({ checkedIn: { ...get().checkedIn, [flightNumber.toUpperCase()]: new Date().toISOString() } }),
      isCheckedIn: (flightNumber) => !!get().checkedIn[flightNumber.toUpperCase()],
    }),
    { name: 'jetsetter_checked_in_flights', storage: zustandStorage },
  ),
);
