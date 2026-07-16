import { router } from 'expo-router';
import { create } from 'zustand';

// Faithful port of IRISActionRouter: navigation runs immediately; data-changing
// tools park a pending action that the chat surfaces as a confirmation card.
// Nothing is committed until the user taps Confirm.

export type PendingKind =
  | 'logExpense'
  | 'checkIn'
  | 'addTrip'
  | 'trackFlight'
  | 'generatePackingList'
  | 'submitExpenses'
  | 'addToCalendar'
  | 'bookFlight'
  | 'cancelBooking';

/** Money-moving kinds: the confirmation must be an explicit on-screen tap —
 *  hands-free voice "yes" is not accepted for these. */
export const TAP_ONLY_KINDS: ReadonlySet<PendingKind> = new Set(['bookFlight', 'cancelBooking']);

export interface PendingAction {
  id: string;
  kind: PendingKind;
  summary: string;
  commit: () => Promise<string>;
}

export type Destination =
  | 'home'
  | 'itinerary'
  | 'iris'
  | 'expenses'
  | 'more'
  | 'checkIn'
  | 'disruption'
  | 'flightTracker'
  | 'documentVault'
  | 'packingList'
  | 'groundTransport'
  | 'currency'
  | 'booking';

export const DESTINATION_NAME: Record<Destination, string> = {
  home: 'Home',
  itinerary: 'your Itinerary',
  iris: 'IRIS',
  expenses: 'Expenses',
  more: 'More',
  checkIn: 'Check-In',
  disruption: 'the Disruption dashboard',
  flightTracker: 'Flight Tracker',
  documentVault: 'Document Vault',
  packingList: 'your Packing List',
  groundTransport: 'Ground Transport',
  currency: 'Currency & Expenses',
  booking: 'Flight Booking',
};

interface IrisRouterState {
  pendingAction: PendingAction | null;
  propose: (a: PendingAction) => void;
  cancel: () => void;
  navigateTo: (dest: Destination) => void;
}

export const useIrisRouter = create<IrisRouterState>((set) => ({
  pendingAction: null,
  propose: (a) => set({ pendingAction: a }),
  cancel: () => set({ pendingAction: null }),
  navigateTo: (dest) => {
    const tabs: Partial<Record<Destination, string>> = {
      home: '/',
      itinerary: '/itinerary',
      iris: '/iris',
      expenses: '/expenses',
      more: '/more',
    };
    const tabHref = tabs[dest];
    if (tabHref) {
      router.navigate(tabHref as never);
      return;
    }
    // Every feature destination maps to a real, shipped screen.
    const real: Partial<Record<Destination, string>> = {
      packingList: '/packing',
      currency: '/currency',
      documentVault: '/vault',
      disruption: '/disruption',
      flightTracker: '/inflight',
      groundTransport: '/ground',
      checkIn: '/itinerary',
      booking: '/booking',
    };
    const realHref = real[dest];
    if (realHref) router.navigate(realHref as never);
  },
}));
