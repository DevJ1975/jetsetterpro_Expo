import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';

interface SessionState {
  status: 'unknown' | 'signedOut' | 'signedIn';
  userId?: string;
  email?: string;
  isAnonymous: boolean;
  setFromSession: (s: Session | null) => void;
}

export const useSession = create<SessionState>((set) => ({
  status: 'unknown',
  isAnonymous: false,
  setFromSession: (s) =>
    set(
      s
        ? {
            status: 'signedIn',
            userId: s.user.id,
            email: s.user.email ?? undefined,
            isAnonymous: s.user.is_anonymous ?? false,
          }
        : { status: 'signedOut', userId: undefined, email: undefined, isAnonymous: false },
    ),
}));
