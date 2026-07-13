/* eslint-disable import/first -- jest.mock() must be hoisted above the imports it mocks */
// Regression for the vault auth bypass: a passcode-only device (no biometric
// hardware) must still be prompted, not degraded open.
const mockGetEnrolledLevel = jest.fn();
const mockAuthenticate = jest.fn();
jest.mock('expo-local-authentication', () => ({
  getEnrolledLevelAsync: (...a: unknown[]) => mockGetEnrolledLevel(...(a as [])),
  authenticateAsync: (...a: unknown[]) => mockAuthenticate(...(a as [])),
  hasHardwareAsync: jest.fn(async () => false),
  isEnrolledAsync: jest.fn(async () => false),
  SecurityLevel: { NONE: 0, SECRET: 1, BIOMETRIC: 2 },
}));

import { authenticate } from '@/src/core/services/biometric';

describe('authenticate', () => {
  beforeEach(() => {
    mockGetEnrolledLevel.mockReset();
    mockAuthenticate.mockReset();
  });

  it('degrades open ONLY when the device has no auth method (level NONE)', async () => {
    mockGetEnrolledLevel.mockResolvedValue(0); // NONE
    await expect(authenticate('Unlock')).resolves.toBe(true);
    expect(mockAuthenticate).not.toHaveBeenCalled();
  });

  it('prompts (does NOT bypass) on a passcode-only device — level SECRET', async () => {
    mockGetEnrolledLevel.mockResolvedValue(1); // SECRET = passcode/PIN, no biometric
    mockAuthenticate.mockResolvedValue({ success: true });
    await expect(authenticate('Unlock')).resolves.toBe(true);
    expect(mockAuthenticate).toHaveBeenCalledTimes(1); // the fix: it must gate
  });

  it('stays locked when the prompt is cancelled or fails', async () => {
    mockGetEnrolledLevel.mockResolvedValue(2); // BIOMETRIC
    mockAuthenticate.mockResolvedValue({ success: false, error: 'user_cancel' });
    await expect(authenticate('Unlock')).resolves.toBe(false);
  });

  it('degrades open if the platform reports no usable method after prompting', async () => {
    mockGetEnrolledLevel.mockResolvedValue(1);
    mockAuthenticate.mockResolvedValue({ success: false, error: 'passcode_not_set' });
    await expect(authenticate('Unlock')).resolves.toBe(true);
  });
});
