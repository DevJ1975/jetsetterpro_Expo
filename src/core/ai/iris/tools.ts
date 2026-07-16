import { AgentToolResult } from '@/src/core/ai/agentLoop';
import { ToolSchema } from '@/src/core/ai/anthropic';
import { BackendError, isBackendConfigured } from '@/src/core/api/backend';
import { confirmCancel, createOrder, getOffer, listOrders, quoteCancel } from '@/src/core/api/duffel';
import { convertCurrency } from '@/src/core/api/exchange';
import { assessConnection } from '@/src/core/connections';
import { searchFlightsViaAgent } from '@/src/core/api/flightAgent';
import {
  bookCar,
  bookStay,
  cancelCar,
  cancelStay,
  listCars,
  listStays,
  quoteCar,
  quoteStay,
  searchCars,
  searchStays,
} from '@/src/core/api/travelBookings';
import { geocodePlace } from '@/src/core/services/geocode';
import {
  describeProductBookings,
  formatCarResults,
  formatStayResults,
  summarizeCarForConfirm,
  summarizeStayForConfirm,
  validateDriver,
  validateGuest,
} from '@/src/core/ai/iris/travelBooking';
import { cToF, fetchWeather } from '@/src/core/api/weather';
import { formatDateRange, makeId, toISODate } from '@/src/core/format';
import { queryClient } from '@/src/core/query';
import { addTripToCalendar } from '@/src/core/services/calendar';
import { useCheckIn } from '@/src/core/store/checkin';
import { useIrisMemory, type MemoryCategory } from '@/src/core/store/irisMemory';
import { useIrisRouter, type Destination, type PendingKind } from '@/src/core/store/irisRouter';
import { extractFlightNumber } from '@/src/core/ai/iris/triggers';
import { activeOrNextTrip, nextUpcomingFlight, useTravel } from '@/src/core/store/travel';
import type { ExpenseCategory } from '@/src/types/models';
import {
  buildCreateOrderPayload,
  describeOrders,
  formatRankedOffers,
  fullOfferToSummary,
  offerExpired,
  summarizeBookingForConfirm,
  trimOfferDetailsForModel,
  validatePassenger,
} from '@/src/core/ai/iris/booking';

const IATA_RE = /^[A-Z]{3}$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_TIME_RE = /^\d{2}:\d{2}$/;
const OFFER_ID_RE = /^off_[A-Za-z0-9]+$/;
const ORDER_ID_RE = /^ord_[A-Za-z0-9]+$/;
const SSR_ID_RE = /^ssr_[A-Za-z0-9]+$/;
const RATE_ID_RE = /^rat_[A-Za-z0-9]+$/;
const STAY_BK_RE = /^sbk_[A-Za-z0-9]+$/;
const CAR_BK_RE = /^cbk_[A-Za-z0-9]+$/;

const BOOKING_NOT_CONNECTED =
  "Flight booking isn't connected in this build yet — it activates when the backend is deployed. The classic Book screen has provider links meanwhile.";

/** Friendly strings for booking API failures — the model relays these
 *  honestly instead of surfacing raw error codes. */
function bookingApiError(e: unknown): string {
  if (e instanceof BackendError) {
    switch (e.code) {
      case 'rate_limited':
        return 'The booking service is briefly rate-limited — try again in a minute or two.';
      case 'ai_unconfigured':
      case 'duffel_unconfigured':
        return BOOKING_NOT_CONNECTED;
      case 'quote_expired':
        return 'That refund quote expired before confirmation — run cancelBooking again for a fresh quote.';
      case 'already_cancelled':
        return 'That booking is already cancelled.';
      case 'not_found':
        return "I couldn't find that booking on this account.";
      case 'bad_request':
        return 'The booking service rejected the request — double-check the details and try again.';
    }
  }
  return 'The booking service had a problem. Nothing was changed — please try again shortly.';
}

// The IRIS tool catalog (working subset for this phase). Tool NAMES and argument
// names match the iOS @Generable tools exactly. READ tools run immediately;
// STAGED WRITE tools park an IRISPendingAction and return a "prepared, awaiting
// confirmation" string — nothing is committed until the user taps Confirm.
//
// Not yet registered (their backing features aren't ported): getFlightStatus,
// searchRentalCars, checkDisruption, traceBaggage, getVisaAndCountryEssentials,
// get_departure_briefing, getLearnedTravelProfile, submitExpenses. They return
// gracefully via the "unknown tool" path if the model ever names them.

const MEMORY_CATEGORIES: MemoryCategory[] = [
  'dietary',
  'seating',
  'hotelStyle',
  'airlinePreference',
  'transportation',
  'destinations',
  'activities',
  'general',
];

const EXPENSE_CATEGORY_MAP: Record<string, ExpenseCategory> = {
  food: 'FOOD',
  transport: 'TRANSPORT',
  accommodation: 'LODGING',
  lodging: 'LODGING',
  entertainment: 'ENTERTAINMENT',
  business: 'BUSINESS',
  shopping: 'SHOPPING',
  medical: 'OTHER',
  mileage: 'OTHER',
  other: 'OTHER',
};

const SCREEN_TO_DESTINATION: Record<string, Destination> = {
  home: 'home',
  itinerary: 'itinerary',
  iris: 'iris',
  expenses: 'expenses',
  more: 'more',
  checkIn: 'checkIn',
  disruption: 'disruption',
  flightTracker: 'flightTracker',
  documentVault: 'documentVault',
  packingList: 'packingList',
  groundTransport: 'groundTransport',
  currency: 'currency',
  booking: 'booking',
};

export const IRIS_TOOLS: ToolSchema[] = [
  {
    name: 'getUserTrips',
    description: "Return the user's saved trips, grounded to their real plans.",
    input_schema: {
      type: 'object',
      properties: {
        filter: { type: 'string', enum: ['upcoming', 'past', 'all'], description: 'Defaults to upcoming.' },
      },
    },
  },
  {
    name: 'getWeather',
    description: 'Current weather at a city or 3-letter IATA airport code.',
    input_schema: {
      type: 'object',
      properties: { location: { type: 'string', description: 'City name or IATA code.' } },
      required: ['location'],
    },
  },
  {
    name: 'convertCurrency',
    description: 'Convert an amount between currencies at live FX rates.',
    input_schema: {
      type: 'object',
      properties: {
        amount: { type: 'number' },
        fromCurrency: { type: 'string', description: '3-letter code' },
        toCurrency: { type: 'string', description: '3-letter code' },
      },
      required: ['amount', 'fromCurrency', 'toCurrency'],
    },
  },
  {
    name: 'rememberUserPreference',
    description: 'Persist one travel preference the user states.',
    input_schema: {
      type: 'object',
      properties: {
        category: { type: 'string', enum: MEMORY_CATEGORIES },
        value: { type: 'string', description: 'Short noun phrase.' },
      },
      required: ['category', 'value'],
    },
  },
  {
    name: 'navigate',
    description: 'Open a screen, or pull up live flight status. Not staged — happens right away.',
    input_schema: {
      type: 'object',
      properties: {
        screen: { type: 'string', enum: Object.keys(SCREEN_TO_DESTINATION) },
        flightNumber: { type: 'string' },
      },
    },
  },
  {
    name: 'logExpense',
    description: 'Prepare a travel expense to log (staged — the user confirms).',
    input_schema: {
      type: 'object',
      properties: {
        amount: { type: 'number' },
        merchant: { type: 'string' },
        currency: { type: 'string', description: 'Defaults to USD.' },
        category: { type: 'string', enum: Object.keys(EXPENSE_CATEGORY_MAP) },
      },
      required: ['amount', 'merchant'],
    },
  },
  {
    name: 'addTrip',
    description: 'Prepare a new trip for the itinerary (staged — the user confirms).',
    input_schema: {
      type: 'object',
      properties: {
        destination: { type: 'string' },
        startDate: { type: 'string', description: 'yyyy-MM-dd' },
        endDate: { type: 'string', description: 'yyyy-MM-dd' },
        name: { type: 'string' },
      },
      required: ['destination', 'startDate', 'endDate'],
    },
  },
  {
    name: 'checkInForFlight',
    description: 'Prepare check-in for the next upcoming flight (staged — the user confirms).',
    input_schema: {
      type: 'object',
      properties: { flightNumber: { type: 'string', description: 'Optional; else next upcoming.' } },
    },
  },
  {
    name: 'generatePackingList',
    description: 'Prepare packing-list generation for a trip (staged — the user confirms).',
    input_schema: {
      type: 'object',
      properties: { tripName: { type: 'string', description: 'Optional; else active/next trip.' } },
    },
  },
  {
    name: 'addToCalendar',
    description: "Prepare to add a trip's events to the device Calendar (staged — the user confirms).",
    input_schema: {
      type: 'object',
      properties: { tripName: { type: 'string', description: 'Optional; else active/next trip.' } },
    },
  },
  {
    name: 'searchFlights',
    description:
      'Search real bookable flights and get a ranked shortlist with live prices (Duffel test mode). Read-only — runs right away. Offers expire ~30 minutes after the search.',
    input_schema: {
      type: 'object',
      properties: {
        origin: { type: 'string', description: '3-letter IATA airport code, e.g. JFK.' },
        destination: { type: 'string', description: '3-letter IATA airport code, e.g. LHR.' },
        departureDate: { type: 'string', description: 'yyyy-MM-dd' },
        returnDate: { type: 'string', description: 'yyyy-MM-dd — include for a round trip.' },
        cabinClass: {
          type: 'string',
          enum: ['economy', 'premium_economy', 'business', 'first'],
          description: 'Defaults to economy.',
        },
        preferences: {
          type: 'string',
          description: 'Free-text traveler preferences, e.g. "cheapest nonstop, morning departure".',
        },
      },
      required: ['origin', 'destination', 'departureDate'],
    },
  },
  {
    name: 'getBookingDetails',
    description:
      'Fresh price, expiry, bag allowance and change/refund conditions for ONE offer from searchFlights. Read-only.',
    input_schema: {
      type: 'object',
      properties: { offerId: { type: 'string', description: 'An off_… id from searchFlights.' } },
      required: ['offerId'],
    },
  },
  {
    name: 'listMyBookings',
    description: "The user's existing flight bookings made in this app (read-only).",
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'bookFlight',
    description:
      'Prepare a flight booking for ONE adult passenger (staged — a confirmation card appears; NOTHING is purchased by this call). Requires the full passenger identity, collected from the user first.',
    input_schema: {
      type: 'object',
      properties: {
        offerId: { type: 'string', description: 'The chosen off_… id from searchFlights.' },
        givenName: { type: 'string', description: 'Passenger first/given name, as on ID.' },
        familyName: { type: 'string', description: 'Passenger last/family name, as on ID.' },
        bornOn: { type: 'string', description: 'Date of birth, yyyy-MM-dd.' },
        gender: { type: 'string', enum: ['m', 'f'], description: 'Airline requirement.' },
        title: { type: 'string', enum: ['mr', 'ms', 'mrs', 'dr'] },
        email: { type: 'string', description: 'Contact email for the booking.' },
        phone: { type: 'string', description: 'Phone with country code, e.g. +14155550123.' },
      },
      required: ['offerId', 'givenName', 'familyName', 'bornOn', 'gender', 'title', 'email', 'phone'],
    },
  },
  {
    name: 'cancelBooking',
    description:
      'Prepare a booking cancellation with the real refund quote (staged — the user confirms on a card; nothing is cancelled by this call).',
    input_schema: {
      type: 'object',
      properties: { orderId: { type: 'string', description: 'An ord_… id from listMyBookings.' } },
      required: ['orderId'],
    },
  },
  {
    name: 'planConnection',
    description:
      "Assess a tight flight connection: estimate the gate-to-gate transfer time and whether the layover is enough. Read-only. Use when the traveler is connecting and asks whether they'll make it, or to guide them from the arrival gate to the departure gate.",
    input_schema: {
      type: 'object',
      properties: {
        layoverMinutes: { type: 'number', description: 'Minutes between landing and the next departure.' },
        fromGate: { type: 'string', description: 'Arrival gate, e.g. B12.' },
        fromTerminal: { type: 'string', description: 'Arrival terminal, e.g. 2.' },
        toGate: { type: 'string', description: 'Departure gate for the connecting flight, e.g. A4.' },
        toTerminal: { type: 'string', description: 'Departure terminal for the connecting flight.' },
      },
      required: ['layoverMinutes'],
    },
  },
  {
    name: 'searchHotels',
    description:
      'Search real bookable hotels near a place for given dates (Duffel Stays, test mode). Read-only.',
    input_schema: {
      type: 'object',
      properties: {
        location: { type: 'string', description: 'City, neighborhood or landmark, e.g. "Paris near the Louvre".' },
        checkIn: { type: 'string', description: 'yyyy-MM-dd' },
        checkOut: { type: 'string', description: 'yyyy-MM-dd' },
        guests: { type: 'number', description: 'Number of adult guests (default 1).' },
      },
      required: ['location', 'checkIn', 'checkOut'],
    },
  },
  {
    name: 'bookHotel',
    description:
      'Prepare a hotel booking (staged — the user confirms; nothing is charged by this call). Requires the guest identity.',
    input_schema: {
      type: 'object',
      properties: {
        searchResultId: { type: 'string', description: 'An ssr_… id from searchHotels.' },
        givenName: { type: 'string' },
        familyName: { type: 'string' },
        email: { type: 'string' },
        phone: { type: 'string', description: 'With country code, e.g. +14155550123.' },
        specialRequests: { type: 'string', description: 'Optional free-text request.' },
      },
      required: ['searchResultId', 'givenName', 'familyName', 'email', 'phone'],
    },
  },
  {
    name: 'cancelHotel',
    description: 'Prepare a hotel-booking cancellation (staged — the user confirms).',
    input_schema: {
      type: 'object',
      properties: { bookingId: { type: 'string', description: 'An sbk_… id from listMyStays.' } },
      required: ['bookingId'],
    },
  },
  {
    name: 'listMyStays',
    description: "The user's existing hotel bookings (read-only).",
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'searchCars',
    description:
      'Search real bookable rental cars at a pickup place for given dates/times (Duffel Cars, test mode). Read-only.',
    input_schema: {
      type: 'object',
      properties: {
        pickupLocation: { type: 'string', description: 'Airport or city for pickup, e.g. "LAX" or "downtown Denver".' },
        dropoffLocation: { type: 'string', description: 'Optional; defaults to the pickup location.' },
        pickupDate: { type: 'string', description: 'yyyy-MM-dd' },
        pickupTime: { type: 'string', description: 'HH:mm (24h)' },
        dropoffDate: { type: 'string', description: 'yyyy-MM-dd' },
        dropoffTime: { type: 'string', description: 'HH:mm (24h)' },
        driverAge: { type: 'number', description: "Driver's age (affects young-driver fees)." },
      },
      required: ['pickupLocation', 'pickupDate', 'pickupTime', 'dropoffDate', 'dropoffTime'],
    },
  },
  {
    name: 'bookCar',
    description:
      'Prepare a rental-car booking (staged — the user confirms; nothing is charged by this call). Requires the driver identity incl. date of birth.',
    input_schema: {
      type: 'object',
      properties: {
        rateId: { type: 'string', description: 'A rat_… id from searchCars.' },
        givenName: { type: 'string' },
        familyName: { type: 'string' },
        bornOn: { type: 'string', description: 'Driver date of birth, yyyy-MM-dd.' },
        email: { type: 'string' },
        phone: { type: 'string', description: 'With country code.' },
      },
      required: ['rateId', 'givenName', 'familyName', 'bornOn', 'email', 'phone'],
    },
  },
  {
    name: 'cancelCar',
    description: 'Prepare a rental-car cancellation (staged — the user confirms).',
    input_schema: {
      type: 'object',
      properties: { bookingId: { type: 'string', description: 'A cbk_… id from listMyCars.' } },
      required: ['bookingId'],
    },
  },
  {
    name: 'listMyCars',
    description: "The user's existing rental-car bookings (read-only).",
    input_schema: { type: 'object', properties: {} },
  },
];

function num(input: Record<string, unknown>, key: string): number | undefined {
  const v = input[key];
  return typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : undefined;
}
function str(input: Record<string, unknown>, key: string): string | undefined {
  const v = input[key];
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

function resolveTrip(tripName?: string) {
  const trips = useTravel.getState().trips;
  if (tripName) {
    const match = trips.find((t) => t.name.toLowerCase().includes(tripName.toLowerCase()));
    if (match) return match;
  }
  return activeOrNextTrip(trips);
}

/** Dispatch a tool call. Returns the tool_result string the model reads back. */
export async function executeIrisTool(
  name: string,
  input: Record<string, unknown>,
): Promise<AgentToolResult> {
  const travel = useTravel.getState();
  const router = useIrisRouter.getState();

  // Stage a confirm-before-commit action. Guards the single pendingAction slot:
  // a re-invocation with the same summary is idempotent (keeps the parked one),
  // and a *different* action while one is still awaiting confirmation is refused
  // rather than silently overwriting it — otherwise a follow-up turn (typed or
  // hands-free voice) could swap the card out from under a pending "yes".
  const stage = (
    kind: PendingKind,
    summary: string,
    commit: () => Promise<string>,
    prepared: string,
  ): AgentToolResult => {
    const existing = useIrisRouter.getState().pendingAction;
    if (existing && existing.summary !== summary) {
      return {
        content: `There's already an action awaiting confirmation: "${existing.summary}". Ask the user to confirm or cancel that one before staging another.`,
      };
    }
    if (!existing) router.propose({ id: makeId(), kind, summary, commit });
    return { content: prepared };
  };

  switch (name) {
    case 'getUserTrips': {
      const filter = str(input, 'filter') ?? 'upcoming';
      const today = toISODate();
      let trips = travel.trips;
      if (filter === 'upcoming') trips = trips.filter((t) => t.endDate >= today);
      else if (filter === 'past') trips = trips.filter((t) => t.endDate < today);
      if (trips.length === 0) return { content: 'No trips found.' };
      const lines = trips
        .sort((a, b) => a.startDate.localeCompare(b.startDate))
        .map(
          (t) =>
            `- ${t.name} — ${t.destination} (${formatDateRange(t.startDate, t.endDate)}), ${t.items.length} item(s)`,
        );
      return { content: `TRIPS:\n${lines.join('\n')}` };
    }

    case 'getWeather': {
      const location = str(input, 'location');
      if (!location) return { content: 'Missing location.', isError: true };
      const w = await fetchWeather(location);
      if (!w) return { content: `Couldn't fetch weather for ${location}.` };
      return { content: `${location}: ${cToF(w.tempC)}°F, ${w.description}.` };
    }

    case 'convertCurrency': {
      const amount = num(input, 'amount');
      const from = str(input, 'fromCurrency');
      const to = str(input, 'toCurrency');
      if (amount == null || !from || !to) return { content: 'Missing amount/from/to.', isError: true };
      const r = await convertCurrency(amount, from, to);
      if (!r) return { content: `Couldn't get a rate for ${from}→${to}.` };
      return {
        content: `${amount.toFixed(2)} ${from.toUpperCase()} = ${r.converted.toFixed(2)} ${to.toUpperCase()} (rate ${r.rate.toFixed(4)}).`,
      };
    }

    case 'rememberUserPreference': {
      const category = str(input, 'category') as MemoryCategory | undefined;
      const value = str(input, 'value');
      if (!category || !MEMORY_CATEGORIES.includes(category) || !value)
        return { content: 'Missing category/value.', isError: true };
      useIrisMemory.getState().remember(category, value);
      return { content: `Saved preference: ${value} (${category}).` };
    }

    case 'navigate': {
      const flightNumber = str(input, 'flightNumber');
      if (flightNumber) {
        router.navigateTo('flightTracker');
        return { content: `Opened Flight Tracker for ${flightNumber.toUpperCase()}.` };
      }
      const screen = str(input, 'screen');
      const dest = screen ? SCREEN_TO_DESTINATION[screen] : undefined;
      if (!dest) return { content: 'No screen specified.', isError: true };
      router.navigateTo(dest);
      return { content: `Opened ${dest}.` };
    }

    case 'logExpense': {
      const amount = num(input, 'amount');
      const merchant = str(input, 'merchant');
      if (amount == null || !merchant) return { content: 'Need an amount and a merchant first.', isError: true };
      const currency = (str(input, 'currency') ?? 'USD').toUpperCase().slice(0, 3);
      const category = EXPENSE_CATEGORY_MAP[str(input, 'category') ?? 'other'] ?? 'OTHER';
      const summary = `Log ${currency} ${amount.toFixed(2)} at ${merchant} (${category})`;
      return stage(
        'logExpense',
        summary,
        async () => {
          travel.addExpense({ id: makeId(), amount, currency, category, merchant, date: toISODate() });
          return `Logged ${currency} ${amount.toFixed(2)} at ${merchant}.`;
        },
        `Prepared: ${summary}. Ask the user to confirm — not saved yet.`,
      );
    }

    case 'addTrip': {
      const destination = str(input, 'destination');
      const startDate = str(input, 'startDate');
      const endDate = str(input, 'endDate');
      if (!destination || !startDate || !endDate) return { content: 'Need destination and both dates.', isError: true };
      const name = str(input, 'name') ?? `Trip to ${destination}`;
      const summary = `Add trip "${name}" — ${destination} (${formatDateRange(startDate, endDate)})`;
      return stage(
        'addTrip',
        summary,
        async () => {
          travel.addTrip({ id: makeId(), name, destination, startDate, endDate, items: [] });
          return `Added trip "${name}".`;
        },
        `Prepared: ${summary}. Ask the user to confirm — not added yet.`,
      );
    }

    case 'checkInForFlight': {
      const explicit = str(input, 'flightNumber');
      const next = nextUpcomingFlight(travel.trips);
      // The check-in store is keyed by the pure flight ident (e.g. "AA100") —
      // every consumer looks it up that way. The fallback title is
      // "AA100 JFK → LAX", so extract the ident before storing, or the
      // check-in would be invisible to the rest of the app.
      const ident = explicit ?? (next ? (extractFlightNumber(next.item.title) ?? undefined) : undefined);
      const label = explicit ?? next?.item.title ?? '';
      if (!ident) return { content: 'No upcoming flight to check in for.' };
      const summary = `Check in for ${label}`;
      return stage(
        'checkIn',
        summary,
        async () => {
          useCheckIn.getState().markCheckedIn(ident);
          return `Checked in for ${label}.`;
        },
        `Prepared: ${summary}. Ask the user to confirm — not checked in yet.`,
      );
    }

    case 'generatePackingList': {
      const trip = resolveTrip(str(input, 'tripName'));
      if (!trip) return { content: 'No trip found to pack for.' };
      const summary = `Generate a packing list for ${trip.name}`;
      return stage(
        'generatePackingList',
        summary,
        async () => {
          router.navigateTo('packingList');
          return `Opened Smart Packing List for ${trip.name}.`;
        },
        `Prepared: ${summary}. Ask the user to confirm — not generated yet.`,
      );
    }

    case 'addToCalendar': {
      const trip = resolveTrip(str(input, 'tripName'));
      if (!trip) return { content: 'No trip found to add.' };
      const summary = `Add ${trip.name} to your Calendar`;
      return stage(
        'addToCalendar',
        summary,
        async () => {
          const r = await addTripToCalendar(trip);
          return r ? `Added ${r.added} event(s) to your calendar.` : `Couldn't access the calendar.`;
        },
        `Prepared: ${summary}. Ask the user to confirm — nothing added yet.`,
      );
    }

    case 'searchFlights': {
      if (!isBackendConfigured()) return { content: BOOKING_NOT_CONNECTED };
      const origin = (str(input, 'origin') ?? '').toUpperCase();
      const destination = (str(input, 'destination') ?? '').toUpperCase();
      const departureDate = str(input, 'departureDate') ?? '';
      const returnDate = str(input, 'returnDate');
      if (!IATA_RE.test(origin) || !IATA_RE.test(destination))
        return { content: 'Need 3-letter IATA airport codes for origin and destination.', isError: true };
      if (!ISO_DATE_RE.test(departureDate) || (returnDate && !ISO_DATE_RE.test(returnDate)))
        return { content: 'Dates must be yyyy-MM-dd.', isError: true };
      try {
        const cabin = str(input, 'cabinClass');
        const result = await searchFlightsViaAgent({
          origin,
          destination,
          departureDate,
          returnDate,
          cabinClass:
            cabin === 'premium_economy' || cabin === 'business' || cabin === 'first'
              ? cabin
              : 'economy',
          preferences: str(input, 'preferences'),
        });
        return { content: formatRankedOffers(result, { origin, destination, departureDate }) };
      } catch (e) {
        return { content: bookingApiError(e) };
      }
    }

    case 'getBookingDetails': {
      if (!isBackendConfigured()) return { content: BOOKING_NOT_CONNECTED };
      const offerId = str(input, 'offerId') ?? '';
      if (!OFFER_ID_RE.test(offerId))
        return { content: 'Need an off_… offer id from searchFlights.', isError: true };
      try {
        const { offer } = await getOffer(offerId);
        // Only the trimmed line enters the transcript — full offers are huge.
        return { content: trimOfferDetailsForModel(offer) };
      } catch (e) {
        return { content: bookingApiError(e) };
      }
    }

    case 'listMyBookings': {
      if (!isBackendConfigured()) return { content: BOOKING_NOT_CONNECTED };
      try {
        const { orders } = await listOrders();
        return { content: describeOrders(orders) };
      } catch (e) {
        return { content: bookingApiError(e) };
      }
    }

    case 'bookFlight': {
      if (!isBackendConfigured()) return { content: BOOKING_NOT_CONNECTED };
      const offerId = str(input, 'offerId') ?? '';
      if (!OFFER_ID_RE.test(offerId))
        return { content: 'Need the off_… offer id the user chose from searchFlights.', isError: true };
      const v = validatePassenger(input);
      if (!v.ok)
        return {
          content: `Cannot book yet — ${v.problems.join('; ')}. Ask the user for the corrected details.`,
          isError: true,
        };
      try {
        // Re-fetch the offer fresh: price/expiry re-check + the Duffel-issued
        // passenger id the order payload must carry.
        const { offer: fullOffer } = await getOffer(offerId);
        const offer = fullOfferToSummary(fullOffer);
        if (offerExpired(offer.expires_at))
          return {
            content:
              'That offer has expired (fares hold ~30 minutes). Run searchFlights again and pick a fresh offer.',
          };
        if (!offer.passengers[0]?.id)
          return { content: 'That offer can no longer be booked — search again for a fresh one.' };
        const payload = buildCreateOrderPayload(offer, v.passenger);
        const summary = summarizeBookingForConfirm(offer, v.passenger);
        return stage(
          'bookFlight',
          summary,
          // Commit runs ONLY on the user's tap; it never rejects — failures
          // resolve to a friendly line so the card can't strand its spinner.
          async () => {
            try {
              const { order } = await createOrder(payload);
              void queryClient.invalidateQueries({ queryKey: ['duffelOrders'] });
              return `Booked! Reference ${order.booking_reference ?? order.id} — total ${order.total_amount ?? offer.total_amount} ${order.total_currency ?? offer.total_currency} (test mode, no real ticket is issued).`;
            } catch (e) {
              return `The booking didn't go through — ${bookingApiError(e)}`;
            }
          },
          `Prepared: booking ${offer.slices[0]?.origin ?? ''}→${offer.slices[0]?.destination ?? ''} for ${v.passenger.givenName} ${v.passenger.familyName}, total ${offer.total_amount} ${offer.total_currency}. Ask the user to confirm on the card — nothing has been purchased yet.`,
        );
      } catch (e) {
        return { content: bookingApiError(e) };
      }
    }

    case 'cancelBooking': {
      if (!isBackendConfigured()) return { content: BOOKING_NOT_CONNECTED };
      const orderId = str(input, 'orderId') ?? '';
      if (!ORDER_ID_RE.test(orderId))
        return { content: 'Need the ord_… booking id from listMyBookings.', isError: true };
      try {
        const { cancellation } = await quoteCancel(orderId);
        const refund = cancellation.refund_amount
          ? `${cancellation.refund_amount} ${cancellation.refund_currency ?? ''}`.trim()
          : 'determined by the airline';
        const summary = `Cancel booking ${orderId}\nRefund: ${refund}`;
        return stage(
          'cancelBooking',
          summary,
          async () => {
            try {
              const r = await confirmCancel(cancellation.id);
              void queryClient.invalidateQueries({ queryKey: ['duffelOrders'] });
              const refunded = r.cancellation.refund_amount
                ? `${r.cancellation.refund_amount} ${r.cancellation.refund_currency ?? ''}`.trim()
                : 'as determined by the airline';
              return `Cancelled. Refund: ${refunded}.`;
            } catch (e) {
              return `The cancellation didn't go through — ${bookingApiError(e)}`;
            }
          },
          `Prepared: cancel ${orderId} with refund ${refund}. Ask the user to confirm on the card — nothing is cancelled yet.`,
        );
      } catch (e) {
        return { content: bookingApiError(e) };
      }
    }

    case 'planConnection': {
      const layover = num(input, 'layoverMinutes');
      if (layover == null || layover <= 0)
        return { content: 'How many minutes is the layover between the two flights?', isError: true };
      // assessConnection works from ISO times; synthesize them from the layover
      // (epoch 0 → epoch + layover) so the math is identical.
      const arrivalISO = new Date(0).toISOString();
      const departureISO = new Date(layover * 60_000).toISOString();
      const a = assessConnection(
        arrivalISO,
        departureISO,
        { gate: str(input, 'fromGate'), terminal: str(input, 'fromTerminal') },
        { gate: str(input, 'toGate'), terminal: str(input, 'toTerminal') },
      );
      const label =
        a.verdict === 'comfortable' ? 'COMFORTABLE' : a.verdict === 'tight' ? 'TIGHT' : 'RISKY';
      return {
        content: `CONNECTION (${label}): ~${a.transferMinutes} min needed vs a ${a.layoverMinutes} min layover (${a.bufferMinutes >= 0 ? '+' : ''}${a.bufferMinutes} min slack). ${a.advice}`,
      };
    }

    case 'searchHotels': {
      if (!isBackendConfigured()) return { content: BOOKING_NOT_CONNECTED };
      const location = str(input, 'location') ?? '';
      const checkIn = str(input, 'checkIn') ?? '';
      const checkOut = str(input, 'checkOut') ?? '';
      if (!location) return { content: 'Where should I look for hotels?', isError: true };
      if (!ISO_DATE_RE.test(checkIn) || !ISO_DATE_RE.test(checkOut))
        return { content: 'Check-in and check-out must be yyyy-MM-dd.', isError: true };
      const geo = await geocodePlace(location);
      if (!geo) return { content: `I couldn't locate "${location}". Try a nearby city or landmark.` };
      try {
        const guests = num(input, 'guests');
        const { results } = await searchStays({
          latitude: geo.latitude,
          longitude: geo.longitude,
          checkInDate: checkIn,
          checkOutDate: checkOut,
          guests: guests && guests > 1 ? Array.from({ length: Math.min(4, guests) }, () => ({ type: 'adult' })) : undefined,
        });
        return { content: formatStayResults(results, location) };
      } catch (e) {
        return { content: bookingApiError(e) };
      }
    }

    case 'bookHotel': {
      if (!isBackendConfigured()) return { content: BOOKING_NOT_CONNECTED };
      const searchResultId = str(input, 'searchResultId') ?? '';
      if (!SSR_ID_RE.test(searchResultId))
        return { content: 'Need the ssr_… hotel id the user chose from searchHotels.', isError: true };
      const v = validateGuest(input);
      if (!v.ok)
        return { content: `Cannot book yet — ${v.problems.join('; ')}. Ask the user for the details.`, isError: true };
      try {
        const { quote } = await quoteStay(searchResultId);
        const summary = summarizeStayForConfirm(quote, v.guest, 'your destination');
        return stage(
          'bookHotel',
          summary,
          async () => {
            try {
              const { booking } = await bookStay(quote.id, { ...v.guest });
              void queryClient.invalidateQueries({ queryKey: ['duffelOrders'] });
              return `Booked! Confirmation ${booking.reference ?? booking.id} (test mode — no charge).`;
            } catch (e) {
              return `The hotel booking didn't go through — ${bookingApiError(e)}`;
            }
          },
          `Prepared: hotel for ${v.guest.given_name} ${v.guest.family_name}, ${quote.amount ?? ''} ${quote.currency ?? ''}. Ask the user to confirm on the card — nothing is charged yet.`,
        );
      } catch (e) {
        return { content: bookingApiError(e) };
      }
    }

    case 'cancelHotel': {
      if (!isBackendConfigured()) return { content: BOOKING_NOT_CONNECTED };
      const bookingId = str(input, 'bookingId') ?? '';
      if (!STAY_BK_RE.test(bookingId))
        return { content: 'Need the sbk_… hotel booking id from listMyStays.', isError: true };
      return stage(
        'cancelHotel',
        `Cancel hotel booking ${bookingId}`,
        async () => {
          try {
            await cancelStay(bookingId);
            void queryClient.invalidateQueries({ queryKey: ['duffelOrders'] });
            return 'Hotel booking cancelled.';
          } catch (e) {
            return `The cancellation didn't go through — ${bookingApiError(e)}`;
          }
        },
        `Prepared: cancel ${bookingId}. Ask the user to confirm on the card — nothing is cancelled yet.`,
      );
    }

    case 'listMyStays': {
      if (!isBackendConfigured()) return { content: BOOKING_NOT_CONNECTED };
      try {
        const { bookings } = await listStays();
        return { content: describeProductBookings(bookings, 'hotel') };
      } catch (e) {
        return { content: bookingApiError(e) };
      }
    }

    case 'searchCars': {
      if (!isBackendConfigured()) return { content: BOOKING_NOT_CONNECTED };
      const pickupLocation = str(input, 'pickupLocation') ?? '';
      const pickupDate = str(input, 'pickupDate') ?? '';
      const pickupTime = str(input, 'pickupTime') ?? '';
      const dropoffDate = str(input, 'dropoffDate') ?? '';
      const dropoffTime = str(input, 'dropoffTime') ?? '';
      if (!pickupLocation) return { content: 'Where should I look for rental cars?', isError: true };
      if (!ISO_DATE_RE.test(pickupDate) || !ISO_DATE_RE.test(dropoffDate))
        return { content: 'Pickup and drop-off dates must be yyyy-MM-dd.', isError: true };
      if (!ISO_TIME_RE.test(pickupTime) || !ISO_TIME_RE.test(dropoffTime))
        return { content: 'Pickup and drop-off times must be HH:mm (24h).', isError: true };
      const pickup = await geocodePlace(pickupLocation);
      if (!pickup) return { content: `I couldn't locate "${pickupLocation}".` };
      const dropoffLoc = str(input, 'dropoffLocation');
      const dropoff = dropoffLoc ? await geocodePlace(dropoffLoc) : undefined;
      try {
        const { results } = await searchCars({
          pickup,
          dropoff: dropoff ?? undefined,
          pickupDate,
          pickupTime,
          dropoffDate,
          dropoffTime,
          driverAge: num(input, 'driverAge'),
        });
        return { content: formatCarResults(results, pickupLocation) };
      } catch (e) {
        return { content: bookingApiError(e) };
      }
    }

    case 'bookCar': {
      if (!isBackendConfigured()) return { content: BOOKING_NOT_CONNECTED };
      const rateId = str(input, 'rateId') ?? '';
      if (!RATE_ID_RE.test(rateId))
        return { content: 'Need the rat_… car id the user chose from searchCars.', isError: true };
      const v = validateDriver(input);
      if (!v.ok)
        return { content: `Cannot book yet — ${v.problems.join('; ')}. Ask the user for the details.`, isError: true };
      try {
        const { quote } = await quoteCar(rateId);
        const summary = summarizeCarForConfirm(quote, v.driver, 'the pickup location');
        return stage(
          'bookCar',
          summary,
          async () => {
            try {
              const { booking } = await bookCar(quote.id, { ...v.driver });
              void queryClient.invalidateQueries({ queryKey: ['duffelOrders'] });
              return `Booked! Confirmation ${booking.reference ?? booking.id} (test mode — no charge).`;
            } catch (e) {
              return `The car booking didn't go through — ${bookingApiError(e)}`;
            }
          },
          `Prepared: rental car for ${v.driver.given_name} ${v.driver.family_name}, ${quote.amount ?? ''} ${quote.currency ?? ''}. Ask the user to confirm on the card — nothing is charged yet.`,
        );
      } catch (e) {
        return { content: bookingApiError(e) };
      }
    }

    case 'cancelCar': {
      if (!isBackendConfigured()) return { content: BOOKING_NOT_CONNECTED };
      const bookingId = str(input, 'bookingId') ?? '';
      if (!CAR_BK_RE.test(bookingId))
        return { content: 'Need the cbk_… car booking id from listMyCars.', isError: true };
      return stage(
        'cancelCar',
        `Cancel rental-car booking ${bookingId}`,
        async () => {
          try {
            await cancelCar(bookingId);
            void queryClient.invalidateQueries({ queryKey: ['duffelOrders'] });
            return 'Rental-car booking cancelled.';
          } catch (e) {
            return `The cancellation didn't go through — ${bookingApiError(e)}`;
          }
        },
        `Prepared: cancel ${bookingId}. Ask the user to confirm on the card — nothing is cancelled yet.`,
      );
    }

    case 'listMyCars': {
      if (!isBackendConfigured()) return { content: BOOKING_NOT_CONNECTED };
      try {
        const { bookings } = await listCars();
        return { content: describeProductBookings(bookings, 'car') };
      } catch (e) {
        return { content: bookingApiError(e) };
      }
    }

    default:
      return { content: `The "${name}" tool isn't available in this build yet.`, isError: true };
  }
}
