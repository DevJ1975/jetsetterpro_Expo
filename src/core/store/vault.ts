import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { zustandStorage } from '@/src/core/persistence/kv';
import { secure } from '@/src/core/persistence/secure';

export type DocType = 'passport' | 'visa' | 'id' | 'insurance' | 'vaccination' | 'other';

export interface VaultDoc {
  id: string;
  type: DocType;
  name: string;
  expiry?: string; // ISO date
  hasNumber: boolean;
}

export const DOC_TYPES: DocType[] = ['passport', 'visa', 'id', 'insurance', 'vaccination', 'other'];
export const DOC_META: Record<DocType, { label: string; icon: string }> = {
  passport: { label: 'Passport', icon: 'globe' },
  visa: { label: 'Visa', icon: 'document-text' },
  id: { label: 'ID Card', icon: 'id-card' },
  insurance: { label: 'Insurance', icon: 'shield-checkmark' },
  vaccination: { label: 'Vaccination', icon: 'medkit' },
  other: { label: 'Other', icon: 'document' },
};

// Metadata only (no sensitive numbers) lives in AsyncStorage. The document
// NUMBER is written to expo-secure-store (OS Keychain/Keystore) under a per-doc
// key — encrypted at rest, revealed only after a biometric prompt.
const numberKey = (id: string) => `vault_doc_${id}`;

export function setDocNumber(id: string, value: string): Promise<void> {
  return secure.set(numberKey(id), value);
}
export function getDocNumber(id: string): Promise<string | null> {
  return secure.get(numberKey(id));
}
export function removeDocNumber(id: string): Promise<void> {
  return secure.remove(numberKey(id));
}

interface VaultState {
  docs: VaultDoc[];
  addMeta: (d: VaultDoc) => void;
  remove: (id: string) => void;
}

export const useVault = create<VaultState>()(
  persist(
    (set, get) => ({
      docs: [],
      addMeta: (d) => set({ docs: [...get().docs, d] }),
      remove: (id) => {
        void removeDocNumber(id);
        set({ docs: get().docs.filter((x) => x.id !== id) });
      },
    }),
    { name: 'jetsetter_vault_documents', storage: zustandStorage },
  ),
);
