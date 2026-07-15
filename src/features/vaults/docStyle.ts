// Document Vault card styling + expiry-urgency helpers, mirroring the iOS
// `DocumentType.colorHex` tiles and `VaultDocument.ExpiryUrgency` thresholds
// (Features/DocumentVault/DocumentModel.swift).

import { palette } from '@/src/ui';
import { parseDate } from '@/src/core/format';
import type { DocType } from '@/src/core/store/vault';

/** Colored type-tile hues: passport blue / visa purple / insurance green /
 *  id orange / vaccination teal. */
export const DOC_COLORS: Record<DocType, string> = {
  passport: '#3E8DE8',
  visa: '#9B6CF0',
  insurance: '#1DB97D',
  id: '#E8A020',
  vaccination: '#2AA8A0',
  other: '#8B92A8',
};

export type ExpiryUrgency = 'expired' | 'critical' | 'warning' | 'safe';

/** Whole calendar days until the ISO date (negative = past), like the iOS
 *  `daysUntilExpiry` day-boundary comparison. */
export function daysUntil(iso: string): number {
  const target = parseDate(iso);
  target.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

/** iOS thresholds: day 0 counts as expired; ≤30d critical; ≤90d warning. */
export function expiryUrgency(days: number): ExpiryUrgency {
  if (days <= 0) return 'expired';
  if (days <= 30) return 'critical';
  if (days <= 90) return 'warning';
  return 'safe';
}

export function urgencyColor(urgency: ExpiryUrgency): string {
  switch (urgency) {
    case 'expired':
    case 'critical':
      return palette.bad;
    case 'warning':
      return palette.warn;
    case 'safe':
      return palette.dim;
  }
}
