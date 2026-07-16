import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { palette, radii, spacing, type } from '@/src/ui';
import { CURRENCIES } from './content';

/**
 * Currency picker sheet — port of the iOS onboarding currency sheet: a list
 * of common ISO codes (code + name + checkmark on the selection).
 */
export function CurrencyPickerModal({
  visible,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selected: string;
  onSelect: (code: string) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Dismiss currency picker" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.xl }]}>
          <View style={styles.handle} />
          <Text style={[type.sub, styles.title]}>Select Currency</Text>
          <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
            {CURRENCIES.map((c, i) => {
              const isSelected = selected === c.code;
              return (
                <Pressable
                  key={c.code}
                  onPress={() => onSelect(c.code)}
                  accessibilityLabel={`${c.name}, ${c.code}${isSelected ? ', selected' : ''}`}
                  style={({ pressed }) => [
                    styles.row,
                    i < CURRENCIES.length - 1 && styles.rowBorder,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={styles.code}>{c.code}</Text>
                  <Text style={[type.bodyDim, { flex: 1 }]}>{c.name}</Text>
                  {isSelected ? (
                    <Ionicons name="checkmark" size={18} color={palette.accent} />
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(4,7,13,0.72)',
  },
  sheet: {
    backgroundColor: palette.elevated,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    borderWidth: 1,
    borderColor: palette.line,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.separator,
    marginBottom: spacing.md,
  },
  title: {
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 14,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.separator,
  },
  code: {
    width: 52,
    fontSize: 16,
    fontWeight: '700',
    color: palette.text,
  },
});
