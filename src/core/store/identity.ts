import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { zustandStorage } from '@/src/core/persistence/kv';

export type IdentityKind =
  | 'preCheck'
  | 'globalEntry'
  | 'clear'
  | 'nexus'
  | 'ktn'
  | 'redress'
  | 'digitalId'
  | 'other';

export interface IdentityCredential {
  id: string;
  kind: IdentityKind;
  number: string;
  expiration?: string; // ISO date
}

export const IDENTITY_KINDS: IdentityKind[] = [
  'preCheck',
  'globalEntry',
  'clear',
  'nexus',
  'ktn',
  'redress',
  'digitalId',
  'other',
];

export const IDENTITY_META: Record<IdentityKind, { label: string; icon: string }> = {
  preCheck: { label: 'TSA PreCheck', icon: 'shield-checkmark' },
  globalEntry: { label: 'Global Entry', icon: 'globe' },
  clear: { label: 'CLEAR', icon: 'eye' },
  nexus: { label: 'NEXUS', icon: 'card' },
  ktn: { label: 'Known Traveler #', icon: 'barcode' },
  redress: { label: 'Redress #', icon: 'document-text' },
  digitalId: { label: 'Digital ID', icon: 'id-card' },
  other: { label: 'Other', icon: 'card' },
};

interface IdentityState {
  credentials: IdentityCredential[];
  add: (c: IdentityCredential) => void;
  remove: (id: string) => void;
}

export const useIdentity = create<IdentityState>()(
  persist(
    (set, get) => ({
      credentials: [],
      add: (c) => set({ credentials: [...get().credentials, c] }),
      remove: (id) => set({ credentials: get().credentials.filter((x) => x.id !== id) }),
    }),
    { name: 'jetsetter_id_state', storage: zustandStorage },
  ),
);
