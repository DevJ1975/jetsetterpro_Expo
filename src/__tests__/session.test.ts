import { useSession } from '@/src/core/store/session';
import type { User } from 'firebase/auth';

// The session store is not persisted, so it imports cleanly with no AsyncStorage.
const asUser = (o: Partial<User>) => o as User;

describe('useSession.setFromUser', () => {
  it('maps a signed-in user to session state', () => {
    useSession.getState().setFromUser(asUser({ uid: 'u1', email: 'a@b.com', isAnonymous: false }));
    const s = useSession.getState();
    expect(s.status).toBe('signedIn');
    expect(s.userId).toBe('u1');
    expect(s.email).toBe('a@b.com');
    expect(s.isAnonymous).toBe(false);
  });

  it('maps an anonymous user (null email → undefined)', () => {
    useSession.getState().setFromUser(asUser({ uid: 'anon', email: null, isAnonymous: true }));
    const s = useSession.getState();
    expect(s.status).toBe('signedIn');
    expect(s.isAnonymous).toBe(true);
    expect(s.email).toBeUndefined();
  });

  it('resets to signedOut on null, clearing userId and isAnonymous', () => {
    useSession.getState().setFromUser(asUser({ uid: 'u1', isAnonymous: true }));
    useSession.getState().setFromUser(null);
    const s = useSession.getState();
    expect(s.status).toBe('signedOut');
    expect(s.userId).toBeUndefined();
    expect(s.isAnonymous).toBe(false);
  });
});
