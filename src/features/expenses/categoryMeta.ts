import type { ExpenseCategory } from '@/src/types/models';

// Expense-category display metadata — the single source of truth for the money
// screens. Colors + glyphs ported from the iOS expense features (solid colored
// square tiles with a white symbol); labels match `CATEGORY_META` in
// src/types/models.ts so copy stays consistent app-wide.

export interface ExpenseCategoryMeta {
  label: string;
  /** Ionicons name (iOS SF Symbol equivalent). */
  icon: string;
  /** Solid tile / chart color. */
  color: string;
  /** 14%-alpha tint of `color` for soft wells (donut legends, subtle chips). */
  tint: string;
}

const tint = (hex: string) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},0.14)`;
};

const meta = (label: string, icon: string, color: string): ExpenseCategoryMeta => ({
  label,
  icon,
  color,
  tint: tint(color),
});

export const EXPENSE_CATEGORY_META: Record<ExpenseCategory, ExpenseCategoryMeta> = {
  FOOD: meta('Food & Dining', 'restaurant', '#E8A020'),
  LODGING: meta('Lodging', 'bed', '#7B5BE6'),
  TRANSPORT: meta('Transport', 'car', '#3B9EF0'),
  ENTERTAINMENT: meta('Entertainment', 'ticket', '#E84D8A'),
  SHOPPING: meta('Shopping', 'bag', '#1DB97D'),
  BUSINESS: meta('Business', 'briefcase', '#4E8FD4'),
  OTHER: meta('Other', 'ellipsis-horizontal', '#8B92A8'),
};
