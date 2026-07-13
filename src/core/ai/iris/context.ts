import { activeOrNextTrip, nextUpcomingFlight } from '@/src/core/store/travelSelectors';
import { formatDate } from '@/src/core/format';
import type { Expense, ItineraryItemType, Trip } from '@/src/types/models';

// Faithful port of IRISContext.currentSnapshot — a compact plain-text snapshot
// of the traveler's live data, injected on the FIRST user turn only so the
// transcript isn't torn down as the clock advances.

const EMOJI: Partial<Record<ItineraryItemType, string>> = {
  flight: '✈',
  hotel: '🏨',
  activity: '⭐',
  car: '🚗',
  restaurant: '🍽',
  boardingPass: '🎫',
  other: '•',
};

function shortDateTime(iso: string): string {
  return formatDate(iso, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/** Returns '' when there is no trip/expense data (keeps the prompt lean for new users). */
export function currentSnapshot(trips: Trip[], expenses: Expense[], now = new Date()): string {
  if (trips.length === 0 && expenses.length === 0) return '';
  const lines: string[] = [];
  const nowISO = now.toISOString();

  const trip = activeOrNextTrip(trips, now);
  if (trip) {
    const today = nowISO.slice(0, 10);
    const isActive = trip.startDate <= today && trip.endDate >= today;
    const range = `${formatDate(trip.startDate)} – ${formatDate(trip.endDate)}`;
    lines.push(`• ${isActive ? 'Current trip' : 'Next trip'}: ${trip.name} — ${trip.destination} (${range})`);

    const upcoming = trip.items
      .filter((i) => (i.endDate ?? i.startDate) >= nowISO)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .slice(0, 3);
    for (const item of upcoming) {
      let line = `    ${EMOJI[item.type] ?? '•'} ${item.title} — ${shortDateTime(item.startDate)}`;
      if (item.location) line += ` · ${item.location}`;
      if (item.notes) line += ` · ${item.notes}`;
      lines.push(line);
    }
  }

  const flight = nextUpcomingFlight(trips, now);
  if (flight) {
    let line = `• Next flight: ${flight.item.title} — ${shortDateTime(flight.item.startDate)}`;
    if (flight.item.location) line += ` (${flight.item.location})`;
    lines.push(line);
  }

  if (expenses.length > 0) {
    const totals = new Map<string, number>();
    for (const e of expenses) totals.set(e.currency, (totals.get(e.currency) ?? 0) + e.amount);
    let dominant: [string, number] | undefined;
    for (const entry of totals) if (!dominant || entry[1] > dominant[1]) dominant = entry;
    let line = `• Expenses logged: ${expenses.length}`;
    if (dominant) line += ` totaling ${dominant[1].toFixed(2)} ${dominant[0]}`;
    lines.push(line);
  }

  if (lines.length === 0) return '';
  return `Live traveler data (use this to ground answers; don't invent details):\n${lines.join('\n')}`;
}

/** Prefix the snapshot onto the first user turn. */
export function composeFirstTurn(userPrompt: string, snapshot: string): string {
  if (!snapshot) return userPrompt;
  return `[Live traveler context — ground your reply in this; don't recite it verbatim]\n${snapshot}\n\n${userPrompt}`;
}
