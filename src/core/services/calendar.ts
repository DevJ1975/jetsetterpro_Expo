import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';
import type { Trip } from '@/src/types/models';

// The RN analog of the iOS CalendarService (EventKit). Requires a development
// build with calendar permission; degrades to `false` when unavailable.

async function getWritableCalendarId(): Promise<string | undefined> {
  if (Platform.OS === 'ios') {
    const cal = await Calendar.getDefaultCalendarAsync();
    return cal?.id;
  }
  const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const writable = cals.find((c) => c.allowsModifications) ?? cals[0];
  return writable?.id;
}

export async function addTripToCalendar(trip: Trip): Promise<{ added: number } | null> {
  try {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status !== 'granted') return null;
    const calendarId = await getWritableCalendarId();
    if (!calendarId) return null;

    let added = 0;
    for (const item of trip.items) {
      const start = new Date(item.startDate);
      const end = item.endDate ? new Date(item.endDate) : new Date(start.getTime() + 60 * 60 * 1000);
      await Calendar.createEventAsync(calendarId, {
        title: `${trip.name} · ${item.title}`,
        startDate: start,
        endDate: end,
        location: item.location,
        notes: item.confirmation ? `Confirmation: ${item.confirmation}` : undefined,
      });
      added += 1;
    }
    return { added };
  } catch (e) {
    console.warn('[calendar] addTripToCalendar failed:', e);
    return null;
  }
}
