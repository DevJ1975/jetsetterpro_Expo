import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Badge, Card, ListRow, ScreenHeader, SectionLabel, palette, spacing, type } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { AppFooter } from '@/src/features/common/AppFooter';
import { IconWell } from '@/src/features/common/IconWell';
import { usePreferences } from '@/src/core/store/preferences';

type Row = { title: string; subtitle?: string; icon: string; pro?: boolean; slug: string };
type Group = { header: string; rows: Row[] };

const CATALOG: Group[] = [
  {
    header: 'AI Features',
    rows: [
      { title: 'IRIS — Travel Agent', subtitle: 'Your AI travel co-pilot', icon: 'sparkles', pro: true, slug: 'iris' },
      { title: 'Trip Disruption AI', subtitle: 'Delay & cancel rebooking', icon: 'warning', pro: true, slug: 'disruption' },
      { title: 'Proactive Intelligence', subtitle: 'Leave-now & check-in nudges', icon: 'bulb', slug: 'intelligence' },
    ],
  },
  {
    header: 'Trip Tools',
    rows: [
      { title: 'Smart Packing List', subtitle: 'AI-generated & weather-aware', icon: 'briefcase', pro: true, slug: 'packing' },
      { title: 'Document Vault', subtitle: 'Encrypted passport & visas', icon: 'lock-closed', pro: true, slug: 'vault' },
      { title: 'Local Experiences', subtitle: 'Restaurants, events, gems', icon: 'compass', slug: 'local' },
    ],
  },
  {
    header: 'Finance',
    rows: [
      { title: 'Currency & Expenses', subtitle: 'Live FX + budget tracking', icon: 'cash', slug: 'currency' },
      { title: 'Submit Expenses', subtitle: 'Expensify · Ramp · Brex · Divvy', icon: 'send', pro: true, slug: 'expense-export' },
    ],
  },
  {
    header: 'Transport',
    rows: [
      { title: 'Ground Transport', subtitle: 'Uber & Lyft estimates', icon: 'car', slug: 'ground' },
      { title: 'Rental Cars', subtitle: 'Enterprise · Hertz · National', icon: 'car-sport', slug: 'rental' },
    ],
  },
  {
    header: 'Before You Fly',
    rows: [
      { title: 'Departure Optimizer', subtitle: 'Traffic + TSA wait', icon: 'time', slug: 'departure' },
      { title: 'Book Flights & Hotels', subtitle: 'Search & book', icon: 'airplane', slug: 'booking' },
      { title: 'Offline Kit', subtitle: 'Pre-cache trip data', icon: 'cloud-offline', slug: 'offline' },
    ],
  },
  {
    header: 'At the Airport',
    rows: [
      { title: 'Departure Board', subtitle: 'Live split-flap', icon: 'grid', slug: 'board' },
      { title: 'Airport Map', subtitle: 'Indoor wayfinding', icon: 'map', slug: 'airport-map' },
      { title: 'Identity & Trusted Traveler', subtitle: 'Digital ID · CLEAR · PreCheck', icon: 'card', slug: 'identity' },
      { title: 'Luggage Tracker', subtitle: 'AirTag & WorldTracer', icon: 'bag-handle', slug: 'luggage' },
      { title: 'Where I Parked', subtitle: 'Save your parking spot', icon: 'car', slug: 'parking' },
    ],
  },
  {
    header: 'Wallet & Documents',
    rows: [
      { title: 'Travel Wallet', subtitle: 'Boarding passes & tickets', icon: 'wallet', slug: 'wallet' },
      { title: 'Miles & Loyalty', subtitle: 'Points & status tiers', icon: 'ribbon', slug: 'loyalty' },
      { title: 'Visa Requirements', subtitle: 'Entry rules by country', icon: 'document-text', slug: 'visa' },
    ],
  },
  {
    header: 'In the Air & Abroad',
    rows: [
      { title: 'In-Flight Tracker', subtitle: 'Live altitude & phase', icon: 'airplane', slug: 'inflight' },
      { title: 'Translator', subtitle: 'On-device + camera', icon: 'language', slug: 'translator' },
      { title: 'Travel Essentials', subtitle: 'Emergency #s, tipping, plugs', icon: 'medkit', slug: 'essentials' },
      { title: 'Trip Journal', subtitle: 'Auto photo scrapbook', icon: 'images', slug: 'journal' },
      { title: 'Carbon Footprint', subtitle: 'Emissions & offsets', icon: 'leaf', slug: 'carbon' },
    ],
  },
  {
    header: 'App',
    rows: [
      { title: 'Settings', subtitle: 'Preferences & account', icon: 'settings', slug: 'settings' },
      { title: 'About JetSetter Pro', icon: 'information-circle', slug: 'about' },
    ],
  },
];

export default function MoreScreen() {
  const router = useRouter();
  const name = usePreferences((s) => s.name);
  const homeAirport = usePreferences((s) => s.homeAirport);
  const homeCurrency = usePreferences((s) => s.homeCurrency);

  // Ported screens route directly; everything else lands on the shared "coming soon".
  const REAL_ROUTES: Record<string, string> = {
    iris: '/iris',
    parking: '/parking',
    packing: '/packing',
    currency: '/currency',
    wallet: '/wallet',
    loyalty: '/loyalty',
    essentials: '/essentials',
    visa: '/visa',
    identity: '/identity',
    settings: '/settings',
    ground: '/ground',
    carbon: '/carbon',
    vault: '/vault',
    rental: '/rental',
    about: '/about',
    journal: '/journal',
    board: '/board',
    'expense-export': '/expense-export',
    departure: '/departure',
    offline: '/offline',
    inflight: '/inflight',
    luggage: '/luggage',
    booking: '/booking',
    translator: '/translator',
    disruption: '/disruption',
    intelligence: '/intelligence',
    local: '/local',
    'airport-map': '/airport-map',
  };

  const openFeature = (row: Row) => {
    const real = REAL_ROUTES[row.slug];
    if (real) {
      router.push(real as never);
      return;
    }
    router.push({ pathname: '/feature/[slug]', params: { slug: row.slug, title: row.title, subtitle: row.subtitle ?? '' } });
  };

  return (
    <Screen contentStyle={{ paddingHorizontal: spacing.xl }}>
      <ScreenHeader overline="Everything else" title="More" style={{ paddingHorizontal: 0 }} />

      <Pressable onPress={() => router.push('/settings')}>
        <Card style={{ marginBottom: spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: palette.fillAccent,
                borderWidth: 1,
                borderColor: palette.lineStrong,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={[type.heading, { color: palette.bright }]}>
                {(name || 'T').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={type.sub}>{name || 'Traveler'}</Text>
              <Text style={[type.bodyDim, { marginTop: 2 }]}>
                {[homeAirport, homeCurrency].filter(Boolean).join(' · ') || 'Set up your profile'}
              </Text>
            </View>
            <Ionicons name="settings-outline" size={22} color={palette.faint} />
          </View>
        </Card>
      </Pressable>

      {CATALOG.map((group) => (
        <Card key={group.header} style={{ marginBottom: spacing.lg }}>
          <SectionLabel>{group.header}</SectionLabel>
          {group.rows.map((row, i) => (
            <ListRow
              key={row.slug}
              last={i === group.rows.length - 1}
              icon={<IconWell name={row.icon} size={18} />}
              title={row.title}
              subtitle={row.subtitle}
              right={row.pro ? <Badge tone="accent" label="Pro" /> : undefined}
              onPress={() => openFeature(row)}
            />
          ))}
        </Card>
      ))}
      <AppFooter />
      <View style={{ height: spacing.xxl }} />
    </Screen>
  );
}
