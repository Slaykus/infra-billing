import type { Period } from '@infra/shared';
import dayjs, { type ManipulateType } from 'dayjs';

/**
 * One billing-period step. `onetime`/`hourly` have no meaningful recurring due date,
 * so they are absent → advanceByPeriod returns null and the date is left untouched.
 */
const PERIOD_STEP: Partial<Record<Period, [number, ManipulateType]>> = {
  daily: [1, 'day'],
  monthly: [1, 'month'],
  quarterly: [3, 'month'],
  yearly: [1, 'year'],
};

/**
 * Advance a billing date forward by exactly one billing period.
 * Returns null when the period has no recurring step (onetime/hourly/unknown).
 */
export function advanceByPeriod(date: Date, period: Period): Date | null {
  const step = PERIOD_STEP[period];
  if (!step) return null;
  const [n, unit] = step;
  // Anchor on the UTC date part (YYYY-MM-DD) to avoid timezone drift, mirroring
  // the frontend quick-bump helper.
  const isoDay = dayjs(date).format('YYYY-MM-DD');
  return dayjs(`${isoDay}T00:00:00.000Z`).add(n, unit).toDate();
}
