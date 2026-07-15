import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StarField, SuccessAnimation, gradients, hitSlop, spacing } from '@/src/ui';
import { usePreferences } from '@/src/core/store/preferences';
import { CurrencyPickerModal } from '@/src/features/onboarding/CurrencyPickerModal';
import { GradientCTA } from '@/src/features/onboarding/GradientCTA';
import { HeroPage } from '@/src/features/onboarding/HeroPage';
import { LogoPill } from '@/src/features/onboarding/LogoPill';
import { PageDots } from '@/src/features/onboarding/PageDots';
import { SetupPage } from '@/src/features/onboarding/SetupPage';
import { HERO_PAGES, currencyLabel } from '@/src/features/onboarding/content';

// Onboarding — port of iOS `OnboardingView.swift`: hero gradient + star field,
// animated logo pill, three hero pages and a setup form in a paged carousel,
// capsule page dots, and a gradient CTA. Profile fields are staged locally and
// committed atomically on "Get Started"; Skip completes onboarding without
// persisting a partially-typed profile.

const PAGE_COUNT = HERO_PAGES.length + 1;

export default function Onboarding() {
  const router = useRouter();
  const setProfile = usePreferences((s) => s.setProfile);
  const completeOnboarding = usePreferences((s) => s.completeOnboarding);
  const { width } = useWindowDimensions();

  const scrollRef = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const [celebrating, setCelebrating] = useState(false);
  const [name, setName] = useState('');
  const [homeAirport, setHomeAirport] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [pickerOpen, setPickerOpen] = useState(false);

  // A real IATA code is exactly three letters (e.g. JFK, ORD). Empty is fine —
  // the airport is optional and simply isn't committed.
  const airportValid = /^[A-Za-z]{3}$/.test(homeAirport.trim());
  const lastPage = page === PAGE_COUNT - 1;

  // Commit everything in one place so abandoning onboarding (or skipping)
  // never leaves a partially-typed profile behind — same contract as the
  // previous implementation and the iOS `completeOnboarding()`.
  const finish = () => {
    const trimmedName = name.trim();
    const profile: Parameters<typeof setProfile>[0] = { homeCurrency: currency };
    if (trimmedName) profile.name = trimmedName;
    if (airportValid) profile.homeAirport = homeAirport.trim().toUpperCase();
    setProfile(profile);
    // Celebrate first; the success overlay commits onboarding + navigates on
    // dismiss (completing it earlier would trip the root gate and unmount us).
    setCelebrating(true);
  };

  const completeAndGo = () => {
    completeOnboarding();
    router.replace('/');
  };

  // Skip proceeds without persisting the staged fields; store defaults stand
  // and the user can fill this in later from Settings.
  const skip = () => {
    completeOnboarding();
    router.replace('/');
  };

  const goToPage = (i: number) => {
    scrollRef.current?.scrollTo({ x: i * width, animated: true });
    setPage(i);
  };

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    setPage(Math.max(0, Math.min(PAGE_COUNT - 1, i)));
  };

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={gradients.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <StarField count={60} seed={7} />

      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.header}>
            <LogoPill />
            <Pressable
              onPress={skip}
              hitSlop={hitSlop}
              style={styles.skip}
              accessibilityRole="button"
              accessibilityHint="Finishes setup without entering profile details"
            >
              <Text style={styles.skipText}>Skip</Text>
            </Pressable>
          </View>

          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            onMomentumScrollEnd={onMomentumEnd}
            style={{ flex: 1 }}
          >
            {HERO_PAGES.map((p, i) => (
              <HeroPage key={p.kicker} page={p} width={width} active={page === i} />
            ))}
            <SetupPage
              width={width}
              name={name}
              onNameChange={setName}
              airport={homeAirport}
              onAirportChange={setHomeAirport}
              airportValid={airportValid}
              currencyLabel={currencyLabel(currency)}
              onOpenCurrency={() => setPickerOpen(true)}
            />
          </ScrollView>

          <View style={styles.controls}>
            <PageDots count={PAGE_COUNT} index={page} />
            <GradientCTA
              title={lastPage ? 'Get Started' : 'Continue'}
              icon={lastPage ? 'checkmark' : 'arrow-forward'}
              onPress={lastPage ? finish : () => goToPage(page + 1)}
            />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <CurrencyPickerModal
        visible={pickerOpen}
        selected={currency}
        onSelect={(code) => {
          setCurrency(code);
          setPickerOpen(false);
        }}
        onClose={() => setPickerOpen(false)}
      />

      {celebrating ? (
        <SuccessAnimation
          title="You're all set"
          subtitle={name.trim() ? `Welcome aboard, ${name.trim()}.` : 'Welcome aboard.'}
          onDismiss={completeAndGo}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    paddingTop: spacing.lg,
  },
  skip: {
    position: 'absolute',
    right: spacing.xl,
    top: spacing.lg,
    bottom: 0,
    justifyContent: 'center',
  },
  skipText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.55)',
  },
  controls: {
    paddingHorizontal: 32,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.xl,
  },
});
