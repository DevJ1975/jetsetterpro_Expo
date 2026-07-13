/* eslint-disable import/first -- jest.mock() must be hoisted above the imports it mocks */
// Regression for the account-deletion privacy bug: vault.clearAll() must purge
// every document number from the OS Keychain, not just the AsyncStorage metadata.
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
    removeItem: jest.fn(async () => undefined),
  },
}));

const mockDeleteItemAsync = jest.fn(async () => undefined);
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: (...args: unknown[]) => mockDeleteItemAsync(...(args as [])),
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'unlocked',
}));

import { useVault } from '@/src/core/store/vault';

describe('vault.clearAll (privacy purge)', () => {
  beforeEach(() => {
    mockDeleteItemAsync.mockClear();
    useVault.setState({ docs: [] });
  });

  it('purges every doc number from the Keychain and empties metadata', async () => {
    useVault.setState({
      docs: [
        { id: 'd1', type: 'passport', name: 'US Passport', hasNumber: true },
        { id: 'd2', type: 'visa', name: 'Schengen Visa', hasNumber: true },
      ],
    });

    await useVault.getState().clearAll();

    expect(useVault.getState().docs).toEqual([]);
    expect(mockDeleteItemAsync).toHaveBeenCalledWith('vault_doc_d1');
    expect(mockDeleteItemAsync).toHaveBeenCalledWith('vault_doc_d2');
    expect(mockDeleteItemAsync).toHaveBeenCalledTimes(2);
  });

  it('is a no-op on the Keychain when there are no docs', async () => {
    await useVault.getState().clearAll();
    expect(mockDeleteItemAsync).not.toHaveBeenCalled();
    expect(useVault.getState().docs).toEqual([]);
  });
});
