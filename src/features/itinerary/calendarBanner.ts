import { create } from 'zustand';

// Transient calendar-sync status shared between the itinerary tab and the trip
// detail screen — the RN analog of the iOS ItineraryViewModel's
// `calendarStatusMessage` (surfaced as a top banner in ItineraryView). The
// banner auto-dismisses after 3 seconds, matching the iOS `Task.sleep(3s)`.

const AUTO_HIDE_MS = 3000;

interface CalendarBannerState {
  message: string | null;
  /** Show `message` in the banner; replaces any current one and restarts the 3s auto-hide. */
  show: (message: string) => void;
  hide: () => void;
}

let hideTimer: ReturnType<typeof setTimeout> | undefined;

export const useCalendarBanner = create<CalendarBannerState>((set) => ({
  message: null,
  show: (message) => {
    clearTimeout(hideTimer);
    set({ message });
    hideTimer = setTimeout(() => set({ message: null }), AUTO_HIDE_MS);
  },
  hide: () => {
    clearTimeout(hideTimer);
    set({ message: null });
  },
}));
