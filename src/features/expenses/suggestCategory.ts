import type { ExpenseCategory } from '@/src/types/models';

// Pure merchant-keyword → category heuristic. The RN stand-in for the iOS
// on-device Apple Intelligence `ExpenseCategorizer` — deterministic, offline,
// and unit-testable. Rules are checked in order; first match wins (so
// "Airport Cafe" is FOOD, not TRANSPORT). Returns null when nothing matches,
// leaving the caller's current pick intact.

const RULES: readonly (readonly [RegExp, ExpenseCategory])[] = [
  [
    /coffee|caf[eé]|espresso|restaurant|bakery|bistro|pizz|sushi|ramen|noodle|burger|grill|diner|deli\b|taco|steak|brunch|breakfast|donut|doughnut|gelato|ice cream|bar\b|pub\b|brewery|winery|izakaya|kitchen|eatery|food/,
    'FOOD',
  ],
  [
    /hotel|hyatt|marriott|hilton|westin|sheraton|ritz|four seasons|accor|inn\b|hostel|motel|airbnb|resort|lodge|ryokan|suites/,
    'LODGING',
  ],
  [
    /uber|lyft|taxi|cab\b|air(?:line|ways|lines)?\b|delta|united|jetblue|lufthansa|ana\b|jal\b|train|rail|amtrak|metro|subway|transit|bus\b|ferry|shuttle|parking|toll|gas\b|fuel|petrol|shell|chevron|exxon|hertz|avis|enterprise|sixt|car rental|rental car|mileage/,
    'TRANSPORT',
  ],
  [
    /cinema|movie|theat(?:er|re)|museum|gallery|concert|ticket|show\b|club\b|golf|tour\b|spa\b|arcade|karaoke|stadium|aquarium|zoo\b|amusement/,
    'ENTERTAINMENT',
  ],
  [
    /market|store|shop|mall|boutique|outlet|amazon|target|walmart|costco|ikea|uniqlo|duty[- ]?free|pharmacy|drugstore|souvenir|bookstore/,
    'SHOPPING',
  ],
  [
    /fedex|ups\b|usps|dhl|print|copy|office|cowork|wework|regus|conference|summit|expo\b|notary|supplies/,
    'BUSINESS',
  ],
];

/** Best-guess category for a merchant name, or null when unrecognized. */
export function suggestCategory(merchant: string): ExpenseCategory | null {
  const m = merchant.trim().toLowerCase();
  if (!m) return null;
  for (const [re, category] of RULES) {
    if (re.test(m)) return category;
  }
  return null;
}
