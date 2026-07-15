import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { zustandStorage } from '@/src/core/persistence/kv';

// Check-in state (the RN analog of CheckInStateStore) — used by IRIS's
// checkInForFlight tool, the check-in-window trigger, and the full check-in
// flow (app/checkin.tsx: seat map → confirming → boarding pass).

interface CheckInState {
  checkedIn: Record<string, string>; // flightNumber → ISO timestamp
  /** Confirmed seat per flight ident (upper-cased), written by the seat map. */
  seats: Record<string, string>;
  markCheckedIn: (flightNumber: string, seat?: string) => void;
  isCheckedIn: (flightNumber: string) => boolean;
  /** Seat confirmed during check-in for this flight, if any. */
  seatFor: (flightNumber: string) => string | undefined;
}

export const useCheckIn = create<CheckInState>()(
  persist(
    (set, get) => ({
      checkedIn: {},
      seats: {},
      markCheckedIn: (flightNumber, seat) => {
        const key = flightNumber.toUpperCase();
        set({
          checkedIn: { ...get().checkedIn, [key]: new Date().toISOString() },
          seats: seat ? { ...get().seats, [key]: seat } : get().seats,
        });
      },
      isCheckedIn: (flightNumber) => !!get().checkedIn[flightNumber.toUpperCase()],
      seatFor: (flightNumber) => get().seats[flightNumber.toUpperCase()],
    }),
    { name: 'jetsetter_checked_in_flights', storage: zustandStorage },
  ),
);
