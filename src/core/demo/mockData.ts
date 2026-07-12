import type { Expense, Trip } from '@/src/types/models';
import { makeId, toISODate } from '@/src/core/format';

// Demo fixtures — the RN analog of the iOS MockDataService/DemoSeeder. In demo
// mode the app is fully explorable with no backend. The active trip is
// "Boston Pitch Day" (DL2244, Gate B27, Seat 1A) to match the iOS demo.

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function atTime(base: Date, days: number, hours: number, minutes = 0): string {
  const d = addDays(base, days);
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
}

export function demoTrips(now: Date = new Date()): Trip[] {
  return [
    {
      id: 'demo-trip-boston',
      name: 'Boston Pitch Day',
      destination: 'Boston, MA',
      startDate: toISODate(now),
      endDate: toISODate(addDays(now, 2)),
      items: [
        {
          id: makeId(),
          type: 'flight',
          title: 'DL2244 · JFK → BOS',
          startDate: atTime(now, 0, 9, 10),
          endDate: atTime(now, 0, 10, 32),
          location: 'Gate B27 · Seat 1A',
          confirmation: 'HXR7QK',
        },
        {
          id: makeId(),
          type: 'hotel',
          title: 'The Newbury Boston',
          startDate: atTime(now, 0, 15, 0),
          endDate: atTime(now, 2, 11, 0),
          location: 'Boston, MA',
          confirmation: 'NB-889201',
        },
        {
          id: makeId(),
          type: 'flight',
          title: 'DL2109 · BOS → JFK',
          startDate: atTime(now, 2, 18, 45),
          endDate: atTime(now, 2, 20, 5),
          location: 'Gate C14 · Seat 2C',
          confirmation: 'HXR7QK',
        },
      ],
    },
    {
      id: 'demo-trip-tokyo',
      name: 'Tokyo Product Summit',
      destination: 'Tokyo, Japan',
      startDate: toISODate(addDays(now, 20)),
      endDate: toISODate(addDays(now, 27)),
      items: [
        {
          id: makeId(),
          type: 'flight',
          title: 'JL5 · JFK → HND',
          startDate: atTime(now, 20, 13, 25),
          endDate: atTime(now, 21, 16, 40),
          location: 'Gate A5 · Seat 4K',
          confirmation: 'JL-22K9Z',
        },
        {
          id: makeId(),
          type: 'hotel',
          title: 'Park Hyatt Tokyo',
          startDate: atTime(now, 21, 18, 0),
          endDate: atTime(now, 27, 11, 0),
          location: 'Shinjuku, Tokyo',
          confirmation: 'PH-TYO-4471',
        },
      ],
    },
  ];
}

export function demoExpenses(now: Date = new Date()): Expense[] {
  return [
    { id: makeId(), amount: 42.5, currency: 'USD', category: 'FOOD', merchant: 'Tatte Bakery', date: toISODate(now) },
    { id: makeId(), amount: 389.0, currency: 'USD', category: 'LODGING', merchant: 'The Newbury Boston', date: toISODate(now) },
    { id: makeId(), amount: 28.75, currency: 'USD', category: 'TRANSPORT', merchant: 'Uber', date: toISODate(now) },
    { id: makeId(), amount: 64.2, currency: 'USD', category: 'FOOD', merchant: 'Row 34', date: toISODate(addDays(now, -1)) },
    { id: makeId(), amount: 120.0, currency: 'USD', category: 'BUSINESS', merchant: 'WeWork Day Pass', date: toISODate(addDays(now, -1)) },
    { id: makeId(), amount: 18.0, currency: 'USD', category: 'ENTERTAINMENT', merchant: 'MFA Boston', date: toISODate(addDays(now, -2)) },
  ];
}
