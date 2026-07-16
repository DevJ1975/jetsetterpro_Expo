/* eslint-disable import/first -- jest.mock() must be hoisted above the imports it mocks */
// Executor + staging behavior for IRIS's booking tools: the confirm-before-
// commit contract for money actions. API modules are mocked; the staging
// machinery (stage() → useIrisRouter.pendingAction) is real.
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
    removeItem: jest.fn(async () => undefined),
  },
}));
jest.mock('expo-router', () => ({
  router: { navigate: jest.fn(), push: jest.fn() },
}));
jest.mock('@/src/core/services/calendar', () => ({
  addTripToCalendar: jest.fn(async () => ({ added: 0 })),
}));
jest.mock('@/src/core/api/flightAgent', () => ({
  searchFlightsViaAgent: jest.fn(),
}));
jest.mock('@/src/core/api/duffel', () => ({
  getOffer: jest.fn(),
  createOrder: jest.fn(),
  quoteCancel: jest.fn(),
  confirmCancel: jest.fn(),
  listOrders: jest.fn(),
}));
// Keep the REAL BackendError class (bookingApiError uses instanceof); only
// isBackendConfigured becomes controllable.
jest.mock('@/src/core/api/backend', () => ({
  ...jest.requireActual('@/src/core/api/backend'),
  isBackendConfigured: jest.fn(() => true),
}));

import { executeIrisTool } from '@/src/core/ai/iris/tools';
import { BackendError, isBackendConfigured } from '@/src/core/api/backend';
import {
  confirmCancel,
  createOrder,
  getOffer,
  listOrders,
  quoteCancel,
} from '@/src/core/api/duffel';
import { searchFlightsViaAgent } from '@/src/core/api/flightAgent';
import { queryClient } from '@/src/core/query';
import { useIris } from '@/src/core/store/iris';
import { useIrisRouter } from '@/src/core/store/irisRouter';

const mockConfigured = jest.mocked(isBackendConfigured);
const mockSearch = jest.mocked(searchFlightsViaAgent);
const mockGetOffer = jest.mocked(getOffer);
const mockCreateOrder = jest.mocked(createOrder);
const mockQuoteCancel = jest.mocked(quoteCancel);
const mockConfirmCancel = jest.mocked(confirmCancel);
const mockListOrders = jest.mocked(listOrders);

const FUTURE = () => new Date(Date.now() + 20 * 60_000).toISOString();

const fullOffer = (expires = FUTURE()) => ({
  offer: {
    id: 'off_1',
    total_amount: '412.30',
    total_currency: 'USD',
    expires_at: expires,
    owner: { name: 'British Airways', iata_code: 'BA' },
    slices: [
      {
        origin: { iata_code: 'JFK' },
        destination: { iata_code: 'LHR' },
        segments: [{ departing_at: '2026-08-14T08:05:00Z', arriving_at: '2026-08-14T20:10:00Z' }],
      },
    ],
    passengers: [{ id: 'pas_1', type: 'adult' }],
  },
});

const passengerInput = {
  offerId: 'off_1',
  givenName: 'Amira',
  familyName: 'Khan',
  bornOn: '1990-01-01',
  gender: 'f',
  title: 'ms',
  email: 'amira@example.com',
  phone: '+14155550123',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockConfigured.mockReturnValue(true);
  useIrisRouter.setState({ pendingAction: null });
  useIris.setState({ messages: [], isResponding: false });
});

describe('searchFlights tool', () => {
  it('returns the compact ranked block and uppercases IATA codes', async () => {
    mockSearch.mockResolvedValue({
      summary: 'Delta is cheapest.',
      topOffers: [
        { offerId: 'off_2', totalAmount: '366.00', totalCurrency: 'USD', carrier: 'Delta', stops: 1 },
      ],
      searchedAt: new Date().toISOString(),
    });
    const r = await executeIrisTool('searchFlights', {
      origin: 'jfk',
      destination: 'lhr',
      departureDate: '2026-08-14',
    });
    expect(r.isError).toBeUndefined();
    expect(r.content).toContain('off_2');
    expect(r.content).toContain('366.00 USD');
    expect(r.content).toContain('Delta is cheapest.');
    expect(mockSearch).toHaveBeenCalledWith(
      expect.objectContaining({ origin: 'JFK', destination: 'LHR', cabinClass: 'economy' }),
    );
  });

  it('is honest (not an error) when the backend is unconfigured', async () => {
    mockConfigured.mockReturnValue(false);
    const r = await executeIrisTool('searchFlights', {
      origin: 'JFK',
      destination: 'LHR',
      departureDate: '2026-08-14',
    });
    expect(r.isError).toBeUndefined();
    expect(r.content).toContain("isn't connected");
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it('maps rate-limit failures to a friendly retry line', async () => {
    mockSearch.mockRejectedValue(new BackendError('rate_limited', 429));
    const r = await executeIrisTool('searchFlights', {
      origin: 'JFK',
      destination: 'LHR',
      departureDate: '2026-08-14',
    });
    expect(r.content).toContain('rate-limited');
  });
});

describe('bookFlight tool (staged)', () => {
  it('rejects invalid passenger data with aggregated problems and stages nothing', async () => {
    const r = await executeIrisTool('bookFlight', {
      ...passengerInput,
      email: 'bad',
      phone: '415555',
    });
    expect(r.isError).toBe(true);
    expect(r.content).toContain('email');
    expect(r.content).toContain('country code');
    expect(useIrisRouter.getState().pendingAction).toBeNull();
    expect(mockGetOffer).not.toHaveBeenCalled();
  });

  it('stages a booking with total + passenger on the card, nothing purchased', async () => {
    mockGetOffer.mockResolvedValue(fullOffer());
    const r = await executeIrisTool('bookFlight', passengerInput);
    expect(r.isError).toBeUndefined();
    expect(r.content).toContain('nothing has been purchased');
    const pending = useIrisRouter.getState().pendingAction;
    expect(pending?.kind).toBe('bookFlight');
    expect(pending?.summary).toContain('412.30 USD');
    expect(pending?.summary).toContain('Amira Khan');
    expect(mockCreateOrder).not.toHaveBeenCalled(); // staging never buys
  });

  it('refuses an expired offer instead of staging', async () => {
    mockGetOffer.mockResolvedValue(fullOffer(new Date(Date.now() - 1000).toISOString()));
    const r = await executeIrisTool('bookFlight', passengerInput);
    expect(r.content).toContain('expired');
    expect(useIrisRouter.getState().pendingAction).toBeNull();
  });

  it('refuses to stage a different action while one is pending', async () => {
    mockGetOffer.mockResolvedValue(fullOffer());
    await executeIrisTool('bookFlight', passengerInput);
    mockQuoteCancel.mockResolvedValue({
      cancellation: { id: 'ore_1', refund_amount: '200.00', refund_currency: 'USD' },
    });
    const r = await executeIrisTool('cancelBooking', { orderId: 'ord_1' });
    expect(r.content).toContain('already an action awaiting confirmation');
    expect(useIrisRouter.getState().pendingAction?.kind).toBe('bookFlight');
  });

  it('commit books the order, invalidates the orders query, and reports the reference', async () => {
    mockGetOffer.mockResolvedValue(fullOffer());
    await executeIrisTool('bookFlight', passengerInput);
    mockCreateOrder.mockResolvedValue({
      order: { id: 'ord_9', booking_reference: 'ABC123', total_amount: '412.30', total_currency: 'USD' },
    });
    const spy = jest.spyOn(queryClient, 'invalidateQueries');
    const result = await useIrisRouter.getState().pendingAction!.commit();
    expect(result).toContain('ABC123');
    expect(result).toContain('test mode');
    expect(mockCreateOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        selected_offers: ['off_1'],
        passengers: [expect.objectContaining({ id: 'pas_1', given_name: 'Amira' })],
      }),
    );
    expect(spy).toHaveBeenCalledWith({ queryKey: ['duffelOrders'] });
  });

  it('commit failure resolves a friendly line — never rejects', async () => {
    mockGetOffer.mockResolvedValue(fullOffer());
    await executeIrisTool('bookFlight', passengerInput);
    mockCreateOrder.mockRejectedValue(new BackendError('bad_request', 400));
    await expect(useIrisRouter.getState().pendingAction!.commit()).resolves.toContain(
      "didn't go through",
    );
  });
});

describe('cancelBooking tool (staged, two-step)', () => {
  it('stages with the real refund quote on the card', async () => {
    mockQuoteCancel.mockResolvedValue({
      cancellation: { id: 'ore_1', refund_amount: '200.00', refund_currency: 'USD' },
    });
    const r = await executeIrisTool('cancelBooking', { orderId: 'ord_1' });
    expect(r.content).toContain('nothing is cancelled yet');
    const pending = useIrisRouter.getState().pendingAction;
    expect(pending?.kind).toBe('cancelBooking');
    expect(pending?.summary).toContain('200.00 USD');
    expect(mockConfirmCancel).not.toHaveBeenCalled();
  });

  it('commit confirms the quoted cancellation and reports the refund', async () => {
    mockQuoteCancel.mockResolvedValue({
      cancellation: { id: 'ore_1', refund_amount: '200.00', refund_currency: 'USD' },
    });
    await executeIrisTool('cancelBooking', { orderId: 'ord_1' });
    mockConfirmCancel.mockResolvedValue({
      cancellation: { id: 'ore_1', refund_amount: '200.00', refund_currency: 'USD' },
    });
    const result = await useIrisRouter.getState().pendingAction!.commit();
    expect(result).toContain('Cancelled');
    expect(result).toContain('200.00 USD');
    expect(mockConfirmCancel).toHaveBeenCalledWith('ore_1');
  });

  it('an expired quote resolves to a re-quote suggestion', async () => {
    mockQuoteCancel.mockResolvedValue({
      cancellation: { id: 'ore_1', refund_amount: '200.00', refund_currency: 'USD' },
    });
    await executeIrisTool('cancelBooking', { orderId: 'ord_1' });
    mockConfirmCancel.mockRejectedValue(new BackendError('quote_expired', 410));
    await expect(useIrisRouter.getState().pendingAction!.commit()).resolves.toContain('expired');
  });

  it('reports an already-cancelled booking without staging', async () => {
    mockQuoteCancel.mockRejectedValue(new BackendError('already_cancelled', 409));
    const r = await executeIrisTool('cancelBooking', { orderId: 'ord_1' });
    expect(r.content).toContain('already cancelled');
    expect(useIrisRouter.getState().pendingAction).toBeNull();
  });
});

describe('read tools', () => {
  it('listMyBookings renders the orders block', async () => {
    mockListOrders.mockResolvedValue({
      orders: [
        {
          id: 'ord_1',
          bookingReference: 'ABC123',
          totalAmount: '412.30',
          totalCurrency: 'USD',
          slices: [{ origin: 'JFK', destination: 'LHR', departingAt: '2026-08-14T08:05:00Z' }],
        },
      ],
    });
    const r = await executeIrisTool('listMyBookings', {});
    expect(r.content).toContain('BOOKINGS:');
    expect(r.content).toContain('ABC123');
  });

  it('getBookingDetails trims the full offer to one line', async () => {
    mockGetOffer.mockResolvedValue(fullOffer());
    const r = await executeIrisTool('getBookingDetails', { offerId: 'off_1' });
    expect(r.content).toContain('OFFER off_1');
    expect(r.content).toContain('412.30 USD');
    expect(r.content.length).toBeLessThan(400); // full offers must never leak in
  });
});

describe('confirmPending hardening (iris store)', () => {
  it('a rejecting commit surfaces a failure bubble instead of an unhandled rejection', async () => {
    useIrisRouter.getState().propose({
      id: 'x',
      kind: 'addTrip',
      summary: 'Add trip "T"',
      commit: async () => {
        throw new Error('boom');
      },
    });
    await useIris.getState().confirmPending();
    const msgs = useIris.getState().messages;
    expect(msgs[msgs.length - 1]?.text).toContain("didn't go through");
    expect(useIrisRouter.getState().pendingAction).toBeNull();
  });
});
