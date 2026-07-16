import { Image } from 'expo-image';
import React, { useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { palette, spacing, type } from '@/src/ui';
import { TOUR_SLIDES } from './tourData';

/**
 * "Take the tour" — port of iOS `AboutView.featureTour`: a horizontal paged
 * carousel of the product showcase screens (rounded, gold-edged, deep shadow)
 * with a title + caption per slide and page dots below.
 */
export function TourCarousel() {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    setIndex(Math.max(0, Math.min(TOUR_SLIDES.length - 1, i)));
  };

  return (
    <View>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumEnd}
      >
        {TOUR_SLIDES.map((slide) => (
          <View key={slide.key} style={[styles.page, { width }]}>
            <View style={styles.shot}>
              <View style={styles.shotClip}>
                <Image
                  source={slide.source}
                  style={styles.image}
                  contentFit="contain"
                  transition={150}
                  accessibilityLabel={slide.title}
                />
              </View>
            </View>
            <Text style={[type.sub, styles.slideTitle]}>{slide.title}</Text>
            <Text style={[type.caption, styles.slideCaption]}>{slide.caption}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.dots}>
        {TOUR_SLIDES.map((slide, i) => (
          <View key={slide.key} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  shot: {
    // Shadow lives on the un-clipped wrapper (iOS: black 0.5 / r20 / y12).
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  shotClip: {
    borderRadius: 26,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(220,166,70,0.35)',
    backgroundColor: palette.surface,
  },
  image: {
    height: 420,
    // Showcase screens are phone-shaped (~9:19.5).
    aspectRatio: 9 / 19.5,
  },
  slideTitle: {
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  slideCaption: {
    textAlign: 'center',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.xl,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: spacing.lg,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  dotActive: {
    backgroundColor: palette.accent,
  },
});
