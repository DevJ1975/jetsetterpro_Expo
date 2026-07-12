import { useCheckIn } from './checkin';
import { useIdentity } from './identity';
import { useIris } from './iris';
import { useIrisMemory } from './irisMemory';
import { useLoyalty } from './loyalty';
import { useTravel } from './travel';
import { useWallet } from './wallet';

/** Wipe all locally-stored user data (the "Clear Local Data" action). Preferences
 *  (name/airport/onboarding) are kept unless `includePreferences` is set. */
export function clearAllLocalData(): void {
  useTravel.getState().setAll([], []);
  useIrisMemory.getState().forgetEverything();
  useIris.getState().clear();
  useLoyalty.setState({ accounts: [] });
  useWallet.setState({ items: [] });
  useIdentity.setState({ credentials: [] });
  useCheckIn.setState({ checkedIn: {} });
}
