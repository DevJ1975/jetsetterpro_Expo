// Luggage Tracker — RN port of iOS `LuggageTrackerView.swift`: bag cards with
// status badge, flight + last-location lines, and Track / Find My actions.
// Find My (AirTag) is an iOS-only hand-off to icloud.com/find.

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React from 'react';
import { Alert, Platform, Pressable, Text, View } from 'react-native';
import { Badge, Button, Card, palette, spacing, type } from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { BackHeader } from '@/src/features/common/BackHeader';
import { EmptyState } from '@/src/features/common/EmptyState';
import { relativeDayLabel } from '@/src/core/format';
import { BAG_STATUS_META, Bag, useLuggage } from '@/src/core/store/luggage';

const FIND_MY_URL = 'https://www.icloud.com/find';

export default function LuggageScreen() {
  const router = useRouter();
  const bags = useLuggage((s) => s.bags);
  const remove = useLuggage((s) => s.remove);

  return (
    <Screen contentStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl }}>
      <BackHeader
        overline="AirTag & WorldTracer"
        title="Luggage Tracker"
        right={
          <Pressable
            onPress={() => router.push('/add-bag')}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Add bag"
          >
            <Ionicons name="add-circle" size={30} color={palette.accent} />
          </Pressable>
        }
      />

      {bags.length === 0 ? (
        <Card variant="glass">
          <EmptyState
            icon="bag-handle"
            title="No bags registered"
            subtitle="Add your bags to track them via their tag number or an attached AirTag."
            actionLabel="Add a bag"
            onAction={() => router.push('/add-bag')}
          />
        </Card>
      ) : (
        <View style={{ gap: spacing.md }}>
          {bags.map((b) => (
            <BagCard
              key={b.id}
              bag={b}
              onOpen={() => router.push(`/bag/${b.id}`)}
              onRemove={() =>
                Alert.alert('Remove bag?', b.label, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Remove', style: 'destructive', onPress: () => remove(b.id) },
                ])
              }
            />
          ))}
        </View>
      )}

      <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.lg }]}>
        Track opens the live scan timeline. AirTag location is Find My–only, so the Find My button
        hands off to iCloud.
      </Text>
    </Screen>
  );
}

function BagCard({ bag, onOpen, onRemove }: { bag: Bag; onOpen: () => void; onRemove: () => void }) {
  const meta = BAG_STATUS_META[bag.status];
  const showFindMy = bag.hasAirTag === true && Platform.OS === 'ios';

  return (
    <Card>
      <Pressable onPress={onOpen} style={({ pressed }) => [pressed && { opacity: 0.85 }]}>
        {/* Header row: status-tinted suitcase tile + label + badge */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              backgroundColor: `${meta.color}1F`,
              borderWidth: 1,
              borderColor: `${meta.color}33`,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="briefcase" size={20} color={meta.color} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={type.sub} numberOfLines={1}>
              {bag.label}
            </Text>
            <Text style={[type.caption, { marginTop: 2 }]} numberOfLines={1}>
              {[
                bag.tagNumber ? `Tag #${bag.tagNumber}` : undefined,
                `Updated ${relativeDayLabel(bag.updatedAt)}`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </View>
          <Badge tone={meta.tone} label={meta.label} />
        </View>

        {/* Flight + last-location lines */}
        {bag.airline || bag.flightNumber ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.md }}>
            <Ionicons name="airplane" size={13} color={palette.dim} />
            <Text style={type.caption} numberOfLines={1}>
              {[bag.airline, bag.flightNumber].filter(Boolean).join(' · ')}
            </Text>
          </View>
        ) : null}
        {bag.lastLocation ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <Ionicons name="location" size={13} color={palette.dim} />
            <Text style={type.caption} numberOfLines={1}>
              {bag.lastLocation}
            </Text>
          </View>
        ) : null}
      </Pressable>

      {/* Actions */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md }}>
        <Button
          title="Track"
          size="sm"
          icon={<Ionicons name="locate" size={14} color="#04101F" />}
          onPress={onOpen}
          style={{ flex: 1 }}
        />
        {showFindMy ? (
          <Button
            title="Find My"
            variant="secondary"
            size="sm"
            icon={<Ionicons name="radio" size={14} color={palette.bright} />}
            onPress={() => void WebBrowser.openBrowserAsync(FIND_MY_URL).catch(() => {})}
            style={{ flex: 1 }}
          />
        ) : null}
        <Pressable
          onPress={onRemove}
          hitSlop={8}
          style={{ paddingHorizontal: spacing.xs }}
          accessibilityRole="button"
          accessibilityLabel="Remove bag"
        >
          <Ionicons name="trash-outline" size={16} color={palette.faint} />
        </Pressable>
      </View>
    </Card>
  );
}
