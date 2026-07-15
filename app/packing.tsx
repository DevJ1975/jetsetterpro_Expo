import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';
import {
  Badge,
  Button,
  Card,
  Input,
  ProgressRing,
  fonts,
  palette,
  radii,
  spacing,
  type,
} from '@/src/ui';
import { Screen } from '@/src/features/common/Screen';
import { BackHeader } from '@/src/features/common/BackHeader';
import { EmptyState } from '@/src/features/common/EmptyState';
import { PremiumGate } from '@/src/features/common/PremiumGate';
import { Chips } from '@/src/features/common/Chips';
import { generatePackingList, type WeatherHint } from '@/src/features/packing/generate';
import { activeOrNextTrip, useTravel } from '@/src/core/store/travel';
import { useWeather } from '@/src/core/api/weather';
import { makeId, parseDate } from '@/src/core/format';
import type { PackingItem } from '@/src/types/models';

// iOS SmartPackingListView parity: sparkles generate prompt with context chips,
// progress ring + stat rows, colored category sections with checkable rows,
// add-item sheet (label / category / quantity), regenerate-with-confirm,
// long-press delete.

// Custom (user-added) items carry an id prefix so a regenerate can preserve
// them exactly — the iOS `isCustom` flag folded into the id convention.
const CUSTOM_PREFIX = 'custom-';
const isCustomItem = (i: PackingItem) => i.id.startsWith(CUSTOM_PREFIX);

// Category colors + icons, ported from iOS PackingCategory (colorHex/systemImage).
const CATEGORY_META: Record<string, { icon: string; color: string }> = {
  Clothing: { icon: 'shirt', color: palette.accent },
  Toiletries: { icon: 'water', color: palette.good },
  Electronics: { icon: 'flash', color: palette.warn },
  Documents: { icon: 'document-text', color: '#7B3FBF' },
  Essentials: { icon: 'cube', color: palette.bright },
  Health: { icon: 'medkit', color: palette.bad },
  Misc: { icon: 'bag', color: palette.dim },
};
const categoryMeta = (category: string) => CATEGORY_META[category] ?? CATEGORY_META.Misc;

const ADD_CATEGORIES = [
  'Clothing',
  'Toiletries',
  'Electronics',
  'Documents',
  'Essentials',
  'Health',
  'Misc',
] as const;

export default function PackingScreen() {
  const { tripId } = useLocalSearchParams<{ tripId?: string }>();
  const trips = useTravel((s) => s.trips);
  const setPackingList = useTravel((s) => s.setPackingList);
  const togglePackingItem = useTravel((s) => s.togglePackingItem);

  const trip = useMemo(
    () => (tripId ? trips.find((t) => t.id === tripId) : undefined) ?? activeOrNextTrip(trips),
    [trips, tripId],
  );

  const weather = useWeather(trip?.destination);

  // Add-item sheet state
  const [addOpen, setAddOpen] = useState(false);
  const [draftLabel, setDraftLabel] = useState('');
  const [draftCategory, setDraftCategory] = useState<(typeof ADD_CATEGORIES)[number]>('Misc');
  const [draftQty, setDraftQty] = useState(1);

  const items = useMemo(() => trip?.packingList ?? [], [trip]);
  const packed = items.filter((i) => i.packed).length;
  const total = items.length;
  const pct = total ? Math.round((packed / total) * 100) : 0;

  const grouped = useMemo(() => {
    const m = new Map<string, PackingItem[]>();
    for (const i of items) {
      const key = i.category ?? 'Misc';
      const arr = m.get(key) ?? [];
      arr.push(i);
      m.set(key, arr);
    }
    return [...m.entries()];
  }, [items]);

  const tripDays = useMemo(() => {
    if (!trip) return 0;
    const ms = parseDate(trip.endDate).getTime() - parseDate(trip.startDate).getTime();
    return Math.max(1, Math.round(ms / 86_400_000) + 1);
  }, [trip]);

  const airline = useMemo(
    () => trip?.items.find((i) => i.type === 'flight' && i.provider)?.provider,
    [trip],
  );

  if (!trip) {
    return (
      <Screen scroll={false}>
        <BackHeader title="Packing List" />
        <View style={{ flex: 1 }}>
          <EmptyState icon="briefcase" title="No trip to pack for" subtitle="Add a trip first." />
        </View>
      </Screen>
    );
  }

  const weatherHint: WeatherHint | undefined = weather.data
    ? { tempC: weather.data.tempC, description: weather.data.description }
    : undefined;

  const generate = () => {
    const next = generatePackingList(trip, trip.packingList, weatherHint);
    const customs = (trip.packingList ?? []).filter(isCustomItem);
    setPackingList(trip.id, [...next, ...customs]);
  };

  const confirmRegenerate = () => {
    Alert.alert(
      'Regenerate packing list?',
      "We'll rebuild the suggestions. Your packed check-offs and custom items are kept.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Regenerate', onPress: generate },
      ],
    );
  };

  const confirmDelete = (item: PackingItem) => {
    Alert.alert('Delete item?', item.label, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => setPackingList(trip.id, items.filter((i) => i.id !== item.id)),
      },
    ]);
  };

  const closeAddSheet = () => {
    setAddOpen(false);
    setDraftLabel('');
    setDraftQty(1);
  };

  const commitAddItem = () => {
    const name = draftLabel.trim();
    if (!name) return;
    const item: PackingItem = {
      id: `${CUSTOM_PREFIX}${makeId()}`,
      label: draftQty > 1 ? `${name} ×${draftQty}` : name,
      category: draftCategory,
      packed: false,
    };
    setPackingList(trip.id, [...items, item]);
    closeAddSheet();
  };

  const weatherChipLabel = weather.data
    ? `${Math.round(weather.data.tempC)}° ${weather.data.description}`
    : 'Weather';

  return (
    <Screen contentStyle={{ paddingBottom: spacing.xxxl }}>
      <BackHeader
        overline={trip.name}
        title="Packing List"
        right={
          total > 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
              <Pressable
                onPress={confirmRegenerate}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Regenerate list"
              >
                <Ionicons name="refresh" size={22} color={palette.bright} />
              </Pressable>
              <Pressable
                onPress={() => setAddOpen(true)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Add item"
              >
                <Ionicons name="add-circle" size={28} color={palette.accent} />
              </Pressable>
            </View>
          ) : undefined
        }
      />
      <PremiumGate feature="Smart Packing List">
        <View style={{ paddingHorizontal: spacing.xl }}>
          {total === 0 ? (
            // ── Generate prompt (iOS generatePromptView) ────────────────────
            <View style={{ alignItems: 'center', paddingTop: spacing.xxl, gap: spacing.xl }}>
              <View
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: 48,
                  backgroundColor: palette.fillAccent,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="sparkles" size={40} color={palette.accent} />
              </View>
              <View style={{ alignItems: 'center', gap: spacing.sm }}>
                <Text style={type.heading}>Smart Packing List</Text>
                <Text style={[type.bodyDim, { textAlign: 'center', maxWidth: 300 }]}>
                  We&apos;ll generate a personalized list from your {trip.destination} weather,
                  trip length, and airline baggage rules.
                </Text>
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  justifyContent: 'center',
                  gap: spacing.sm,
                }}
              >
                <ContextChip icon="partly-sunny" label={weatherChipLabel} />
                <ContextChip icon="calendar" label={`${tripDays} ${tripDays === 1 ? 'day' : 'days'}`} />
                <ContextChip icon="airplane" label={airline ?? 'Airline rules'} />
              </View>
              <Button
                title="Generate My List"
                size="lg"
                onPress={generate}
                icon={<Ionicons name="sparkles" size={16} color="#04101F" />}
                style={{ alignSelf: 'stretch', marginTop: spacing.sm }}
              />
            </View>
          ) : (
            <>
              {/* ── Progress ring + stats (iOS progressRing card) ─────────── */}
              <Card variant="glass">
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xl }}>
                  <ProgressRing progress={total ? packed / total : 0} size={80} strokeWidth={10}>
                    <Text
                      style={{
                        fontFamily: fonts.rounded.bold,
                        fontSize: 20,
                        color: palette.text,
                      }}
                    >
                      {pct}%
                    </Text>
                    <Text style={[type.caption, { fontSize: 11 }]}>packed</Text>
                  </ProgressRing>
                  <View style={{ gap: 6 }}>
                    <StatRow icon="checkmark-circle" color={palette.good} label={`${packed} packed`} />
                    <StatRow icon="ellipse-outline" color={palette.dim} label={`${total - packed} remaining`} />
                    <StatRow icon="bag" color={palette.accent} label={`${total} items total`} />
                  </View>
                </View>
              </Card>

              {/* ── Category sections ─────────────────────────────────────── */}
              {grouped.map(([category, rows]) => {
                const meta = categoryMeta(category);
                const done = rows.filter((r) => r.packed).length;
                return (
                  <View key={category} style={{ marginTop: spacing.xl }}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        paddingHorizontal: spacing.xs,
                        marginBottom: spacing.sm,
                      }}
                    >
                      <Ionicons name={meta.icon as never} size={12} color={meta.color} />
                      <Text style={[type.overline, { color: meta.color }]}>{category}</Text>
                      <View style={{ flex: 1 }} />
                      <Text style={type.caption}>
                        {done}/{rows.length}
                      </Text>
                    </View>
                    <Card>
                      {rows.map((it, i) => (
                        <Pressable
                          key={it.id}
                          onPress={() => togglePackingItem(trip.id, it.id)}
                          onLongPress={() => confirmDelete(it)}
                          delayLongPress={350}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: spacing.md,
                            paddingVertical: 10,
                            borderBottomWidth: i === rows.length - 1 ? 0 : 0.5,
                            borderBottomColor: palette.line,
                          }}
                        >
                          <Ionicons
                            name={it.packed ? 'checkmark-circle' : 'ellipse-outline'}
                            size={22}
                            color={it.packed ? palette.good : palette.faint}
                          />
                          <Text
                            style={[
                              type.body,
                              { flexShrink: 1 },
                              it.packed && {
                                color: palette.faint,
                                textDecorationLine: 'line-through',
                              },
                            ]}
                            numberOfLines={2}
                          >
                            {it.label}
                          </Text>
                          {isCustomItem(it) ? <Badge tone="accent" label="Custom" /> : null}
                        </Pressable>
                      ))}
                    </Card>
                  </View>
                );
              })}

              <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.lg }]}>
                Tap to check off · long-press to delete
              </Text>
            </>
          )}
        </View>
      </PremiumGate>

      {/* ── Add-item sheet (iOS AddPackingItemSheet) ─────────────────────── */}
      <Modal visible={addOpen} transparent animationType="slide" onRequestClose={closeAddSheet}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' }}
        >
          <View
            style={{
              backgroundColor: palette.elevated,
              borderTopLeftRadius: radii.sheet,
              borderTopRightRadius: radii.sheet,
              padding: spacing.xl,
              paddingBottom: spacing.xxxl,
              gap: spacing.lg,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Pressable onPress={closeAddSheet} hitSlop={10} style={{ width: 64 }}>
                <Text style={[type.body, { color: palette.bright }]}>Cancel</Text>
              </Pressable>
              <Text style={[type.sub, { flex: 1, textAlign: 'center' }]}>Add Item</Text>
              <Pressable
                onPress={commitAddItem}
                disabled={!draftLabel.trim()}
                hitSlop={10}
                style={{ width: 64, alignItems: 'flex-end' }}
              >
                <Text
                  style={[
                    type.body,
                    {
                      color: draftLabel.trim() ? palette.bright : palette.faint,
                      fontWeight: '700',
                    },
                  ]}
                >
                  Add
                </Text>
              </Pressable>
            </View>

            <Input
              label="Item"
              placeholder="e.g. Hiking boots"
              value={draftLabel}
              onChangeText={setDraftLabel}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={commitAddItem}
            />

            <View style={{ gap: spacing.sm }}>
              <Text style={type.overline}>Category</Text>
              <Chips options={ADD_CATEGORIES} value={draftCategory} onChange={setDraftCategory} />
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[type.overline, { flex: 1 }]}>Quantity</Text>
              <StepperButton
                icon="remove"
                disabled={draftQty <= 1}
                onPress={() => setDraftQty((q) => Math.max(1, q - 1))}
              />
              <Text style={[type.stat, { minWidth: 52, textAlign: 'center' }]}>{draftQty}</Text>
              <StepperButton
                icon="add"
                disabled={draftQty >= 99}
                onPress={() => setDraftQty((q) => Math.min(99, q + 1))}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  );
}

// ── Small pieces ─────────────────────────────────────────────────────────────

function ContextChip({ icon, label }: { icon: string; label: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: radii.pill,
        backgroundColor: palette.fillAccent,
        borderWidth: 1,
        borderColor: palette.line,
      }}
    >
      <Ionicons name={icon as never} size={12} color={palette.accent} />
      <Text style={{ color: palette.bright, fontSize: 12, fontWeight: '700' }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function StatRow({ icon, color, label }: { icon: string; color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Ionicons name={icon as never} size={14} color={color} />
      <Text style={[type.body, { fontWeight: '500' }]}>{label}</Text>
    </View>
  );
}

function StepperButton({
  icon,
  onPress,
  disabled,
}: {
  icon: 'add' | 'remove';
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      style={{
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: palette.elevated2,
        borderWidth: 1,
        borderColor: palette.line,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.4 : 1,
      }}
      accessibilityRole="button"
      accessibilityLabel={icon === 'add' ? 'Increase quantity' : 'Decrease quantity'}
      accessibilityState={{ disabled: !!disabled }}
    >
      <Ionicons name={icon} size={18} color={palette.bright} />
    </Pressable>
  );
}
