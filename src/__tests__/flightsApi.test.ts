/* eslint-disable import/first -- jest.mock() must be hoisted above the imports it mocks */
// flightWatches.ts reaches Firebase auth/Firestore → mock AsyncStorage (their
// persistence layer) like the other store-adjacent tests.
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
    removeItem: jest.fn(async () => undefined),
  },
}));

import { inFlightWindow, statusLabel, statusTone, type FlightStatus } from '@/src/core/api/flights';
import { deriveWatches, watchId } from '@/src/core/firebase/flightWatches';
import type { Trip } from '@/src/types/models';

function flight(dep: string, arr: string): FlightStatus {
  return {
    ident: 'AA100',
    date: dep.slice(0, 10),
    status: 'scheduled',
    origin: { iata: 'JFK', times: { scheduled: dep } },
    destination: { iata: 'LAX', times: { scheduled: arr } },
    source: 'test',
    fetchedAt: new Date().toISOString(),
  };
}

describe('inFlightWindow (drives the live-refresh polling)', () => {
  const dep = '2026-07-20T10:00:00-04:00';
  const arr = '2026-07-20T13:00:00-07:00';
  const f = flight(dep, arr);
  const t = (iso: string) => Date.parse(iso);

  it('opens 6h before departure and closes 2h after arrival', () => {
    expect(inFlightWindow(f, t('2026-07-20T03:59:00-04:00'))).toBe(false);
    expect(inFlightWindow(f, t('2026-07-20T04:01:00-04:00'))).toBe(true);
    expect(inFlightWindow(f, t('2026-07-20T14:59:00-07:00'))).toBe(true);
    expect(inFlightWindow(f, t('2026-07-20T15:01:00-07:00'))).toBe(false);
  });

  it('is false for undefined or unparseable flights', () => {
    expect(inFlightWindow(undefined)).toBe(false);
    expect(inFlightWindow(flight('', ''))).toBe(false);
  });
});

describe('status label + tone (iOS pill parity)', () => {
  it('maps the enum to board-style labels', () => {
    expect(statusLabel('scheduled')).toBe('ON TIME');
    expect(statusLabel('delayed', 25)).toBe('DELAYED 25m');
    expect(statusLabel('cancelled')).toBe('CANCELLED');
  });
  it('tones match the iOS flightStatusColor mapping', () => {
    expect(statusTone('scheduled')).toBe('good');
    expect(statusTone('delayed')).toBe('warn');
    expect(statusTone('cancelled')).toBe('bad');
    expect(statusTone('unknown')).toBe('neutral');
  });
});

describe('deriveWatches (disruption-watcher mirror)', () => {
  const now = Date.parse('2026-07-14T12:00:00Z');
  const trip: Trip = {
    id: 't1',
    name: 'NYC',
    destination: 'New York',
    startDate: '2026-07-15',
    endDate: '2026-07-20',
    items: [
      {
        id: 'i1',
        type: 'flight',
        title: 'AA100 JFK → LAX',
        startDate: '2026-07-15T10:00:00Z', // within 72h
      },
      {
        id: 'i2',
        type: 'flight',
        title: 'AA200 LAX → JFK',
        startDate: '2026-07-19T10:00:00Z', // beyond 72h
      },
      { id: 'i3', type: 'hotel', title: 'Hotel', startDate: '2026-07-15T15:00:00Z' },
      { id: 'i4', type: 'flight', title: 'Flight with no number', startDate: '2026-07-15T12:00:00Z' },
    ],
  };

  it('mirrors only parseable flights inside the 72h horizon', () => {
    const watches = deriveWatches('u1', [trip], now);
    expect(watches).toHaveLength(1);
    expect(watches[0]).toMatchObject({
      uid: 'u1',
      ident: 'AA100',
      date: '2026-07-15',
      origin: 'JFK',
      dest: 'LAX',
      notify: true,
    });
    expect(watchId(watches[0])).toBe('u1_AA100_2026-07-15');
  });
});
