// Loyalty program catalog — RN port of iOS `LoyaltyProgramCatalog`
// (Features/LoyaltyVault/LoyaltyModel.swift), extended with the card-points
// currencies (Amex MR / Chase UR / Capital One). Each entry carries the brand
// color + short tile monogram rendered as the row's colored square.

import type { LoyaltyKind } from '@/src/core/store/loyalty';

export interface LoyaltyProgram {
  /** Stable catalog id persisted on the account (`programId`). */
  id: string;
  name: string;
  /** 2–3 letter monogram for the brand tile. */
  tile: string;
  /** Brand color (dark-bg safe — white tile text must read on it). */
  color: string;
  kind: LoyaltyKind;
}

export const LOYALTY_PROGRAMS: LoyaltyProgram[] = [
  // ── Airlines (US) ─────────────────────────────────────────────────────────
  { id: 'AA', name: 'American AAdvantage', tile: 'AA', color: '#B61F23', kind: 'airline' },
  { id: 'UA', name: 'United MileagePlus', tile: 'UA', color: '#005DAA', kind: 'airline' },
  { id: 'DL', name: 'Delta SkyMiles', tile: 'DL', color: '#98002E', kind: 'airline' },
  { id: 'WN', name: 'Southwest Rapid Rewards', tile: 'WN', color: '#304CB2', kind: 'airline' },
  { id: 'AS', name: 'Alaska Mileage Plan', tile: 'AS', color: '#01426A', kind: 'airline' },
  { id: 'B6', name: 'JetBlue TrueBlue', tile: 'B6', color: '#003876', kind: 'airline' },
  // ── Airlines (international) ──────────────────────────────────────────────
  { id: 'BA', name: 'British Airways Executive Club', tile: 'BA', color: '#075AAA', kind: 'airline' },
  { id: 'AF', name: 'Air France Flying Blue', tile: 'AF', color: '#002B7F', kind: 'airline' },
  { id: 'LH', name: 'Lufthansa Miles & More', tile: 'LH', color: '#05164D', kind: 'airline' },
  { id: 'EK', name: 'Emirates Skywards', tile: 'EK', color: '#D71921', kind: 'airline' },
  { id: 'QR', name: 'Qatar Privilege Club', tile: 'QR', color: '#5C0931', kind: 'airline' },
  { id: 'SQ', name: 'Singapore KrisFlyer', tile: 'SQ', color: '#0F2A52', kind: 'airline' },
  { id: 'JL', name: 'JAL Mileage Bank', tile: 'JL', color: '#E60012', kind: 'airline' },
  { id: 'NH', name: 'ANA Mileage Club', tile: 'NH', color: '#13448F', kind: 'airline' },
  { id: 'QF', name: 'Qantas Frequent Flyer', tile: 'QF', color: '#EE0000', kind: 'airline' },
  // ── Hotels ────────────────────────────────────────────────────────────────
  { id: 'MARRIOTT', name: 'Marriott Bonvoy', tile: 'MB', color: '#7D2248', kind: 'hotel' },
  { id: 'HILTON', name: 'Hilton Honors', tile: 'HH', color: '#0072BC', kind: 'hotel' },
  { id: 'HYATT', name: 'World of Hyatt', tile: 'WOH', color: '#00264A', kind: 'hotel' },
  { id: 'IHG', name: 'IHG One Rewards', tile: 'IHG', color: '#003C7E', kind: 'hotel' },
  { id: 'ACCOR', name: 'Accor ALL', tile: 'ALL', color: '#050033', kind: 'hotel' },
  { id: 'WYNDHAM', name: 'Wyndham Rewards', tile: 'WR', color: '#A41E34', kind: 'hotel' },
  // ── Rental cars ───────────────────────────────────────────────────────────
  { id: 'HERTZ', name: 'Hertz Gold Plus Rewards', tile: 'HZ', color: '#B07A2E', kind: 'car' },
  { id: 'AVIS', name: 'Avis Preferred', tile: 'AV', color: '#D4001A', kind: 'car' },
  { id: 'NATIONAL', name: 'National Emerald Club', tile: 'NE', color: '#1B8B3C', kind: 'car' },
  // ── Card points ───────────────────────────────────────────────────────────
  { id: 'AMEX_MR', name: 'Amex Membership Rewards', tile: 'MR', color: '#006FCF', kind: 'other' },
  { id: 'CHASE_UR', name: 'Chase Ultimate Rewards', tile: 'UR', color: '#117ACA', kind: 'other' },
  { id: 'C1_MILES', name: 'Capital One Miles', tile: 'C1', color: '#D03027', kind: 'other' },
];

export function findProgram(id?: string): LoyaltyProgram | undefined {
  if (!id) return undefined;
  return LOYALTY_PROGRAMS.find((p) => p.id === id);
}

/** Fallback brand look for accounts saved before the catalog (free-text). */
export function programTile(programName: string): { tile: string; color: string } {
  const byName = LOYALTY_PROGRAMS.find((p) => p.name.toLowerCase() === programName.toLowerCase());
  if (byName) return { tile: byName.tile, color: byName.color };
  const initials = programName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
  return { tile: initials || '—', color: '#4E5A72' };
}

/** Member numbers render mono with the middle masked: `AB12•••89`. */
export function maskMemberNumber(num: string): string {
  const clean = num.trim();
  if (clean.length <= 5) return clean;
  return `${clean.slice(0, 3)}•••${clean.slice(-3)}`;
}
