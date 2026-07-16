import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { zustandStorage } from '@/src/core/persistence/kv';
import { secure } from '@/src/core/persistence/secure';
import { deleteUserImage } from '@/src/core/firebase/storage';

export type DocType = 'passport' | 'visa' | 'id' | 'insurance' | 'vaccination' | 'other';

export interface VaultDoc {
  id: string;
  type: DocType;
  name: string;
  expiry?: string; // ISO date
  hasNumber: boolean;
  /** Local uri of an attached photo of the physical document (image-picker). */
  photoUri?: string;
  /** Cloud Storage download URL, once synced — survives reinstall/device change. */
  remoteUrl?: string;
  /** Cloud Storage object path, kept so the image can be deleted deterministically. */
  storagePath?: string;
}

/** Offline emergency contact surfaced in Emergency Mode. */
export interface EmergencyContact {
  name: string;
  phone: string;
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
  /** Emergency-mode contact ({name, phone}); metadata only, editable inline. */
  emergencyContact?: EmergencyContact;
  addMeta: (d: VaultDoc) => void;
  remove: (id: string) => void;
  setEmergencyContact: (c?: EmergencyContact) => void;
  /** Purge every doc's secure-store number, then clear metadata. Awaited by
   *  account deletion so the Keychain entries don't outlive the account. */
  clearAll: () => Promise<void>;
}

export const useVault = create<VaultState>()(
  persist(
    (set, get) => ({
      docs: [],
      emergencyContact: undefined,
      addMeta: (d) => set({ docs: [...get().docs, d] }),
      remove: (id) => {
        const doc = get().docs.find((x) => x.id === id);
        void removeDocNumber(id);
        if (doc?.storagePath) void deleteUserImage(doc.storagePath);
        set({ docs: get().docs.filter((x) => x.id !== id) });
      },
      setEmergencyContact: (c) => set({ emergencyContact: c }),
      clearAll: async () => {
        await Promise.all(get().docs.map((d) => removeDocNumber(d.id)));
        await Promise.all(get().docs.map((d) => deleteUserImage(d.storagePath)));
        set({ docs: [], emergencyContact: undefined });
      },
    }),
    { name: 'jetsetter_vault_documents', storage: zustandStorage },
  ),
);
