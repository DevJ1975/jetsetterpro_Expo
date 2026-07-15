import type { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

export type IoniconName = ComponentProps<typeof Ionicons>['name'];

export interface HeroPageContent {
  icon: IoniconName;
  kicker: string;
  title: string;
  subtitle: string;
}

/** The three hero pages — copy ported 1:1 from iOS `OnboardingView.pages`. */
export const HERO_PAGES: HeroPageContent[] = [
  {
    icon: 'airplane',
    kicker: 'PRIVATE. PRECISE. POWERFUL.',
    title: 'Welcome to\nJetSetter Pro',
    subtitle:
      'Your world-class travel companion. Built for executives who expect everything to work perfectly.',
  },
  {
    icon: 'briefcase',
    kicker: '8 INTEGRATED FEATURES',
    title: 'Everything\nIn One Place',
    subtitle:
      'Flights, hotels, ground transport, rental cars, itineraries, and expenses — seamlessly unified.',
  },
  {
    icon: 'sparkles',
    kicker: 'POWERED BY CLAUDE AI',
    title: 'Your AI Travel\nConcierge',
    subtitle:
      'Powered by Claude — ask anything. Get instant, expert travel advice personalized to your journey.',
  },
];

/** Common currency codes — ported from iOS `UserPreferences.supportedCurrencies`. */
export const CURRENCIES: { code: string; name: string }[] = [
  { code: 'USD', name: 'US Dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British Pound' },
  { code: 'JPY', name: 'Japanese Yen' },
  { code: 'CAD', name: 'Canadian Dollar' },
  { code: 'AUD', name: 'Australian Dollar' },
  { code: 'CHF', name: 'Swiss Franc' },
  { code: 'CNY', name: 'Chinese Yuan' },
  { code: 'HKD', name: 'Hong Kong Dollar' },
  { code: 'SGD', name: 'Singapore Dollar' },
  { code: 'AED', name: 'UAE Dirham' },
  { code: 'MXN', name: 'Mexican Peso' },
  { code: 'BRL', name: 'Brazilian Real' },
  { code: 'INR', name: 'Indian Rupee' },
  { code: 'NZD', name: 'New Zealand Dollar' },
];

export function currencyLabel(code: string): string {
  const match = CURRENCIES.find((c) => c.code === code);
  return match ? `${match.code} — ${match.name}` : code;
}
