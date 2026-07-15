import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { zustandStorage } from '@/src/core/persistence/kv';

// Expense-export provider connections — the RN analog of the iOS
// `ExpenseExportRegistry` + `ExpenseConnectionsView` state. Beta scope:
// connections are local flags persisted on-device (no OAuth yet); real
// provider submission activates for connected accounts after beta.

export type ExpenseProviderId = 'expensify' | 'ramp' | 'brex' | 'divvy';
export type ConnectionStatus = 'connected' | 'disconnected';

export interface ExpenseProviderMeta {
  id: ExpenseProviderId;
  name: string;
  /** Single brand letter shown in the 44pt tile. */
  letter: string;
  /** Tile fill. */
  tile: string;
  /** Letter color (Ramp is yellow-on-black; the rest are white). */
  letterColor: string;
  tagline: string;
}

export const EXPENSE_PROVIDERS: ExpenseProviderMeta[] = [
  { id: 'expensify', name: 'Expensify', letter: 'E', tile: '#0BA95F', letterColor: '#FFFFFF', tagline: 'Receipts & expense reports' },
  { id: 'ramp', name: 'Ramp', letter: 'R', tile: '#111318', letterColor: '#F5D538', tagline: 'Corporate cards & spend' },
  { id: 'brex', name: 'Brex', letter: 'B', tile: '#F45D22', letterColor: '#FFFFFF', tagline: 'Business expense reports' },
  { id: 'divvy', name: 'Divvy', letter: 'D', tile: '#2E6BE6', letterColor: '#FFFFFF', tagline: 'Budgets & reimbursements' },
];

interface ConnectionsState {
  status: Record<ExpenseProviderId, ConnectionStatus>;
  connect: (id: ExpenseProviderId) => void;
  disconnect: (id: ExpenseProviderId) => void;
}

const DISCONNECTED: Record<ExpenseProviderId, ConnectionStatus> = {
  expensify: 'disconnected',
  ramp: 'disconnected',
  brex: 'disconnected',
  divvy: 'disconnected',
};

export const useExpenseConnections = create<ConnectionsState>()(
  persist(
    (set) => ({
      status: { ...DISCONNECTED },
      connect: (id) => set((s) => ({ status: { ...s.status, [id]: 'connected' } })),
      disconnect: (id) => set((s) => ({ status: { ...s.status, [id]: 'disconnected' } })),
    }),
    {
      name: 'jetsetter_expense_connections',
      storage: zustandStorage,
      partialize: (s) => ({ status: s.status }),
    },
  ),
);
