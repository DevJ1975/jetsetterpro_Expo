import { useCheckIn } from './checkin';
import { useIdentity } from './identity';
import { useIris } from './iris';
import { useIrisMemory } from './irisMemory';
import { useJournal } from './journal';
import { useLoyalty } from './loyalty';
import { useLuggage } from './luggage';
import { useTravel } from './travel';
import { useVault } from './vault';
import { useWallet } from './wallet';

/** Wipe all locally-stored user data (the "Clear Local Data" action). Preferences
 *  (name/airport/onboarding) are kept unless `includePreferences` is set.
 *
 *  Async because the Document Vault also purges document numbers from the OS
 *  Keychain (expo-secure-store) — the caller (account deletion) awaits this so
 *  no personal data survives. */
export async function clearAllLocalData(): Promise<void> {
  useTravel.getState().setAll([], []);
  useIrisMemory.getState().forgetEverything();
  useIris.getState().clear();
  useLoyalty.setState({ accounts: [] });
  useWallet.setState({ items: [] });
  useIdentity.setState({ credentials: [] });
  useCheckIn.setState({ checkedIn: {}, seats: {} });
  useJournal.setState({ photos: {} });
  useLuggage.setState({ bags: [] });
  await useVault.getState().clearAll(); // metadata + Keychain document numbers
}
