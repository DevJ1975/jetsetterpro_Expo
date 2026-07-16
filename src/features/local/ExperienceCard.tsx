import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Text, View } from 'react-native';
import { Button, Card, palette, spacing, type } from '@/src/ui';
import { formatDistance } from '@/src/core/api/places';
import { EXPERIENCE_META, type Experience } from './experiences';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function CoverBadge({ label, bg }: { label: string; bg: string }) {
  return (
    <View
      style={{
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 999,
        backgroundColor: bg,
      }}
    >
      <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' }}>
        {label}
      </Text>
    </View>
  );
}

/** Rich carousel card (iOS ExperienceCard port). No venue photos come back
 *  from Overpass, so the cover is a category-tinted gradient block with the
 *  category icon — a deliberate deviation from the iOS AsyncImage cover. */
export function ExperienceCard({
  experience,
  openNow,
  onOpen,
}: {
  experience: Experience;
  /** Derived from the OSM opening_hours tag; undefined hides the badge. */
  openNow?: boolean;
  onOpen: () => void;
}) {
  const meta = EXPERIENCE_META[experience.category];

  return (
    <Card style={{ width: 260 }}>
      {/* Cover — category-tinted gradient + big icon */}
      <View style={{ borderRadius: 12, overflow: 'hidden' }}>
        <LinearGradient
          colors={[`${meta.color}59`, `${meta.color}14`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ height: 110, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name={meta.icon as IoniconName} size={40} color={meta.color} />
        </LinearGradient>
        <View
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            right: 8,
            flexDirection: 'row',
            justifyContent: 'space-between',
          }}
        >
          <CoverBadge label={meta.label} bg={meta.color} />
          {openNow != null ? (
            <CoverBadge label={openNow ? 'Open' : 'Closed'} bg={openNow ? palette.good : palette.faint} />
          ) : (
            <View />
          )}
        </View>
      </View>

      <Text style={[type.sub, { marginTop: spacing.md }]} numberOfLines={2}>
        {experience.name}
      </Text>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: spacing.xs }}>
        <Ionicons name="star" size={11} color={palette.warn} />
        <Text style={[type.caption, { color: palette.warn }]}>Local favorite</Text>
        <Text style={type.caption}>·</Text>
        <Text style={type.caption} numberOfLines={1}>
          {formatDistance(experience.distanceM)} away
        </Text>
      </View>
      <Text style={[type.caption, { marginTop: 2 }]} numberOfLines={1}>
        {experience.kind}
      </Text>

      <Button
        title={experience.category === 'attraction' ? 'Book / Directions' : 'Open in Maps'}
        size="sm"
        variant="secondary"
        onPress={onOpen}
        style={{ marginTop: spacing.md }}
      />
    </Card>
  );
}
