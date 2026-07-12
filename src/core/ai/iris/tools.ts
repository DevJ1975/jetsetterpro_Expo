import { AgentToolResult } from '@/src/core/ai/agentLoop';
import { ToolSchema } from '@/src/core/ai/anthropic';
import { convertCurrency } from '@/src/core/api/exchange';
import { cToF, fetchWeather } from '@/src/core/api/weather';
import { formatDateRange, makeId, toISODate } from '@/src/core/format';
import { addTripToCalendar } from '@/src/core/services/calendar';
import { useCheckIn } from '@/src/core/store/checkin';
import { useIrisMemory, type MemoryCategory } from '@/src/core/store/irisMemory';
import { useIrisRouter, type Destination } from '@/src/core/store/irisRouter';
import { activeOrNextTrip, nextUpcomingFlight, useTravel } from '@/src/core/store/travel';
import type { ExpenseCategory } from '@/src/types/models';

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
      router.propose({
        id: makeId(),
        kind: 'logExpense',
        summary,
        commit: async () => {
          travel.addExpense({ id: makeId(), amount, currency, category, merchant, date: toISODate() });
          return `Logged ${currency} ${amount.toFixed(2)} at ${merchant}.`;
        },
      });
      return { content: `Prepared: ${summary}. Ask the user to confirm — not saved yet.` };
    }

    case 'addTrip': {
      const destination = str(input, 'destination');
      const startDate = str(input, 'startDate');
      const endDate = str(input, 'endDate');
      if (!destination || !startDate || !endDate) return { content: 'Need destination and both dates.', isError: true };
      const name = str(input, 'name') ?? `Trip to ${destination}`;
      const summary = `Add trip "${name}" — ${destination} (${formatDateRange(startDate, endDate)})`;
      router.propose({
        id: makeId(),
        kind: 'addTrip',
        summary,
        commit: async () => {
          travel.addTrip({ id: makeId(), name, destination, startDate, endDate, items: [] });
          return `Added trip "${name}".`;
        },
      });
      return { content: `Prepared: ${summary}. Ask the user to confirm — not added yet.` };
    }

    case 'checkInForFlight': {
      const explicit = str(input, 'flightNumber');
      const next = nextUpcomingFlight(travel.trips);
      const flight = explicit ?? next?.item.title ?? '';
      if (!flight) return { content: 'No upcoming flight to check in for.' };
      const summary = `Check in for ${flight}`;
      router.propose({
        id: makeId(),
        kind: 'checkIn',
        summary,
        commit: async () => {
          useCheckIn.getState().markCheckedIn(flight);
          return `Checked in for ${flight}.`;
        },
      });
      return { content: `Prepared: ${summary}. Ask the user to confirm — not checked in yet.` };
    }

    case 'generatePackingList': {
      const trip = resolveTrip(str(input, 'tripName'));
      if (!trip) return { content: 'No trip found to pack for.' };
      const summary = `Generate a packing list for ${trip.name}`;
      router.propose({
        id: makeId(),
        kind: 'generatePackingList',
        summary,
        commit: async () => {
          router.navigateTo('packingList');
          return `Opened Smart Packing List for ${trip.name}.`;
        },
      });
      return { content: `Prepared: ${summary}. Ask the user to confirm — not generated yet.` };
    }

    case 'addToCalendar': {
      const trip = resolveTrip(str(input, 'tripName'));
      if (!trip) return { content: 'No trip found to add.' };
      const summary = `Add ${trip.name} to your Calendar`;
      router.propose({
        id: makeId(),
        kind: 'addToCalendar',
        summary,
        commit: async () => {
          const r = await addTripToCalendar(trip);
          return r ? `Added ${r.added} event(s) to your calendar.` : `Couldn't access the calendar.`;
        },
      });
      return { content: `Prepared: ${summary}. Ask the user to confirm — nothing added yet.` };
    }

    default:
      return { content: `The "${name}" tool isn't available in this build yet.`, isError: true };
  }
}
