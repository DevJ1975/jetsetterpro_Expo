import type { User } from 'firebase/auth';
import { create } from 'zustand';

interface SessionState {
  status: 'unknown' | 'signedOut' | 'signedIn';
  userId?: string;
  email?: string;
  isAnonymous: boolean;
  setFromUser: (u: User | null) => void;
}

export const useSession = create<SessionState>((set) => ({
  status: 'unknown',
  isAnonymous: false,
  setFromUser: (u) =>
    set(
      u
        ? {
            status: 'signedIn',
            userId: u.uid,
            email: u.email ?? undefined,
            isAnonymous: u.isAnonymous,
          }
        : { status: 'signedOut', userId: undefined, email: undefined, isAnonymous: false },
    ),
}));
