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
  | 'addToCalendar';

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
  | 'currency';

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
};

// Feature screens not yet ported route to the shared "coming soon" screen.
const FEATURE: Partial<Record<Destination, { slug: string; title: string }>> = {
  checkIn: { slug: 'checkin', title: 'Check-In' },
  disruption: { slug: 'disruption', title: 'Trip Disruption AI' },
  flightTracker: { slug: 'flight', title: 'Flight Tracker' },
  documentVault: { slug: 'vault', title: 'Document Vault' },
  packingList: { slug: 'packing', title: 'Smart Packing List' },
  groundTransport: { slug: 'ground', title: 'Ground Transport' },
  currency: { slug: 'currency', title: 'Currency & Expenses' },
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
    const feature = FEATURE[dest];
    if (feature) {
      router.push({ pathname: '/feature/[slug]', params: { slug: feature.slug, title: feature.title } });
    }
  },
}));
