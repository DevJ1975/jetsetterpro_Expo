// Domain models — ported from the iOS Codable structs (Trip / ItineraryItem /
// Expense) and aligned to the Supabase schema-v1 wire format:
//   public.trips     (id, user_id, name, destination, start_date, end_date, items jsonb, packing_list jsonb)
//   public.expenses  (id, user_id, amount, currency, category UPPERCASE, merchant, date, notes)
// The client never sends user_id (DB default auth.uid()); RLS enforces ownership.

export type ISODate = string; // 'YYYY-MM-DD'
export type ISODateTime = string; // full ISO-8601

// ── Itinerary ────────────────────────────────────────────────────────────────

export type ItineraryItemType =
  | 'flight'
  | 'hotel'
  | 'car'
  | 'activity'
  | 'restaurant'
  | 'boardingPass'
  | 'other';

export interface ItineraryItem {
  id: string;
  type: ItineraryItemType;
  title: string;
  startDate: ISODateTime;
  endDate?: ISODateTime;
  location?: string;
  confirmation?: string;
  notes?: string;
}

export interface PackingItem {
  id: string;
  label: string;
  category?: string;
  packed: boolean;
}

export interface Trip {
  id: string;
  name: string;
  destination: string;
  startDate: ISODate;
  endDate: ISODate;
  items: ItineraryItem[];
  packingList?: PackingItem[];
}

// ── Expenses ─────────────────────────────────────────────────────────────────

export type ExpenseCategory =
  | 'FOOD'
  | 'LODGING'
  | 'TRANSPORT'
  | 'ENTERTAINMENT'
  | 'SHOPPING'
  | 'BUSINESS'
  | 'OTHER';

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'FOOD',
  'LODGING',
  'TRANSPORT',
  'ENTERTAINMENT',
  'SHOPPING',
  'BUSINESS',
  'OTHER',
];

export interface Expense {
  id: string;
  amount: number;
  currency: string;
  category: ExpenseCategory;
  merchant: string;
  date: ISODate;
  notes?: string;
}

// ── Display metadata (icon = Ionicons name, tone = design-kit Badge tone) ─────

type Tone = 'accent' | 'good' | 'warn' | 'bad' | 'neutral';

export const ITINERARY_META: Record<ItineraryItemType, { icon: string; label: string }> = {
  flight: { icon: 'airplane', label: 'Flight' },
  hotel: { icon: 'bed', label: 'Hotel' },
  car: { icon: 'car-sport', label: 'Rental Car' },
  activity: { icon: 'sparkles', label: 'Activity' },
  restaurant: { icon: 'restaurant', label: 'Dining' },
  boardingPass: { icon: 'ticket', label: 'Boarding Pass' },
  other: { icon: 'ellipse', label: 'Other' },
};

export const CATEGORY_META: Record<ExpenseCategory, { icon: string; label: string; tone: Tone }> = {
  FOOD: { icon: 'restaurant', label: 'Food & Dining', tone: 'warn' },
  LODGING: { icon: 'bed', label: 'Lodging', tone: 'accent' },
  TRANSPORT: { icon: 'car-sport', label: 'Transport', tone: 'good' },
  ENTERTAINMENT: { icon: 'film', label: 'Entertainment', tone: 'bad' },
  SHOPPING: { icon: 'bag-handle', label: 'Shopping', tone: 'neutral' },
  BUSINESS: { icon: 'briefcase', label: 'Business', tone: 'accent' },
  OTHER: { icon: 'pricetag', label: 'Other', tone: 'neutral' },
};
