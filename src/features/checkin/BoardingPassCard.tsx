import React from 'react';
import { usePreferences } from '@/src/core/store/preferences';
import { useTravel } from '@/src/core/store/travel';
import { useWallet } from '@/src/core/store/wallet';
import { PassCard } from '@/src/features/wallet/PassCard';
import { buildPassData, findPassByIdent } from '@/src/features/wallet/passData';

// Compact boarding-pass preview — the check-in flow's Step-3 embed. Reuses the
// full Apple-Wallet-style `PassCard` body in its tight layout, resolving the
// freshest wallet item for the flight so route/confirmation match the wallet.

export function BoardingPassCard({
  ident,
  date,
  seat,
}: {
  ident: string;
  /** ISO departure instant. */
  date?: string;
  /** Freshly confirmed seat — overrides whatever the wallet item carried. */
  seat?: string;
}) {
  const trips = useTravel((s) => s.trips);
  const stored = useWallet((s) => s.items);
  const passengerName = usePreferences((s) => s.name);

  const item = findPassByIdent(trips, stored, ident);
  const data = buildPassData(item, { ident, date: date ?? item?.date, seat, passengerName });

  return <PassCard data={data} compact shimmer={false} />;
}
