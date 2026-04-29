import { format } from 'date-fns';
import type { Timestamp } from 'firebase/firestore';

export function currency(value: number, code = 'USD') {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: code,
    maximumFractionDigits: 2
  }).format(value || 0);
}

export function shortDate(value: Date | Timestamp) {
  const date = value instanceof Date ? value : value.toDate();
  return format(date, 'MMM d, yyyy');
}

export function monthKey(date = new Date()) {
  return format(date, 'yyyy-MM');
}

export function percent(used: number, total: number) {
  if (!total) return 0;
  return Math.min(100, Math.round((used / total) * 100));
}
