import { activeOrNextTrip, nextUpcomingFlight } from '@/src/core/store/travel';
import type { Trip } from '@/src/types/models';

// A faithful subset of IRISTriggers — proactive suggestions surfaced on Home,
// in priority order. Safety/operational nudges (check-in) rank above habit
// nudges. Each suggestion carries a promptToIRIS the chat runs if tapped, and a
// dismissalKey used to de-dupe / suppress.

export interface IrisSuggestion {
  kind: string;
  icon: string;
  title: string;
  body: string;
  promptToIRIS: string;
  dismissalKey: string;
}

function daysUntil(iso: string, now: Date): number {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return (d.getTime() - now.getTime()) / 86_400_000;
}

export function extractFlightNumber(title: string): string | null {
  const m = title.toUpperCase().match(/([A-Z]{2}\d{2,4})/);
  return m ? m[1] : null;
}

/** Ordered candidate suggestions (highest priority first). */
export function evaluateSuggestions(
  trips: Trip[],
  isCheckedIn: (itemId: string) => boolean,
  now: Date = new Date(),
): IrisSuggestion[] {
  const out: IrisSuggestion[] = [];

  // 1. Check-in window — next flight departs within 24h and not checked in.
  const flight = nextUpcomingFlight(trips, now);
  if (flight) {
    const hrs = daysUntil(flight.item.startDate, now) * 24;
    const fn = extractFlightNumber(flight.item.title) ?? flight.item.title;
    if (hrs > 0 && hrs < 24 && !isCheckedIn(flight.item.id)) {
      out.push({
        kind: 'checkInWindow',
        icon: 'checkmark-circle',
        title: 'Check-in is open soon',
        body: `${fn} departs within a day. Want me to check you in?`,
        promptToIRIS: `Check me in for ${fn}.`,
        dismissalKey: `checkin-${fn}`,
      });
    }
  }

  // 2. Packing nudge — a trip 14–28 days out with no packing list.
  const packTrip = trips.find((t) => {
    const d = daysUntil(t.startDate, now);
    return d >= 14 && d <= 28 && (!t.packingList || t.packingList.length === 0);
  });
  if (packTrip) {
    out.push({
      kind: 'packingNudge',
      icon: 'briefcase',
      title: `Time to plan for ${packTrip.destination}`,
      body: `Your ${packTrip.name} is coming up. I can prepare a smart packing list.`,
      promptToIRIS: `Help me pack for ${packTrip.name}.`,
      dismissalKey: `packing-${packTrip.id}`,
    });
  }

  // 3. Weather watch — a trip departing within 3 days.
  const soonTrip = trips.find((t) => {
    const d = daysUntil(t.startDate, now);
    return d >= 0 && d <= 3;
  });
  if (soonTrip) {
    out.push({
      kind: 'weatherWatch',
      icon: 'partly-sunny',
      title: `${soonTrip.destination} is almost here`,
      body: `Want the forecast so you pack right?`,
      promptToIRIS: `What's the weather for ${soonTrip.destination}?`,
      dismissalKey: `weather-${soonTrip.id}`,
    });
  }

  // 4. Daily briefing — currently on a trip.
  const active = activeOrNextTrip(trips, now);
  if (active) {
    const today = now.toISOString().slice(0, 10);
    if (active.startDate <= today && active.endDate >= today) {
      out.push({
        kind: 'dailyBriefing',
        icon: 'sunny',
        title: 'Your day at a glance',
        body: `Want today's briefing for ${active.name}?`,
        promptToIRIS: `Give me today's briefing.`,
        dismissalKey: `briefing-${active.id}-${today}`,
      });
    }
  }

  // 5. Welcome home — a trip that ended within the last day.
  const justEnded = trips.find((t) => {
    const d = daysUntil(t.endDate, now);
    return d < 0 && d > -1;
  });
  if (justEnded) {
    out.push({
      kind: 'welcomeHome',
      icon: 'home',
      title: 'Welcome back',
      body: `How was ${justEnded.name}? I can help wrap up expenses.`,
      promptToIRIS: `Help me wrap up expenses for ${justEnded.name}.`,
      dismissalKey: `welcome-${justEnded.id}`,
    });
  }

  return out;
}
