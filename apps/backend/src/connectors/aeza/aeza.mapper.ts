import Decimal from 'decimal.js';
import { PaymentData, ServiceData } from '../connector.interface';
import { AezaService, AezaTransaction } from './aeza.types';

const DAYS_PER_MONTH = new Decimal(730).div(24); // ≈30.42, consistent with money.ts

// Aeza terms that map straight onto one of our billing periods.
const TERM_PERIOD: Record<string, string> = {
  hour: 'hourly',
  day: 'daily',
  month: 'monthly',
  quarter_year: 'quarterly',
  year: 'yearly',
  eternal: 'onetime',
};

// Terms money.ts can't represent → normalise the per-term price to a monthly cost. Value = the
// length of the term in months.
const TERM_MONTHS: Record<string, Decimal> = {
  half_day: new Decimal('0.5').div(DAYS_PER_MONTH),
  week: new Decimal(7).div(DAYS_PER_MONTH),
  half_year: new Decimal(6),
};

// Aeza money is in minor units (cents/kopecks) → divide by 100.
function toMajor(minor: number): Decimal {
  return new Decimal(String(minor)).div(100);
}

function parseDate(s?: string): Date | undefined {
  if (!s) return undefined;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

// Price + period from Aeza's paymentTerm. Direct periods keep the raw per-term price (money.ts
// normalises them); the rare terms (half_day/week/half_year) are converted to a monthly cost here,
// so the connector only ever emits periods money.ts understands.
export function mapTerm(term: string, priceMinor: number): { cost: Decimal; period: string } {
  const price = toMajor(priceMinor);
  const direct = TERM_PERIOD[term];
  if (direct) return { cost: price, period: direct };
  const months = TERM_MONTHS[term];
  if (months) return { cost: price.div(months), period: 'monthly' };
  return { cost: price, period: 'monthly' }; // unknown term → treat the price as monthly
}

function mapTypeSlug(slug: string): string {
  if (slug === 'vps') return 'vps';
  if (slug.startsWith('dedic')) return 'dedicated';
  if (slug === 'domain') return 'domain';
  return 'other';
}

export function mapAezaService(s: AezaService): ServiceData {
  const { cost, period } = mapTerm(s.paymentTerm, s.price);
  const code = s.locationCode;
  return {
    externalId: String(s.id),
    name: s.name || s.productName || `aeza-${s.id}`,
    type: mapTypeSlug(s.typeSlug),
    countryCode: code && code.length === 2 ? code.toUpperCase() : undefined,
    cost,
    // currency left unset → the sync fills it from the account currency (Aeza is single-currency).
    period,
    nextBilling: parseDate(s.expiresAt),
    meta: {
      ip: s.ip,
      status: s.status,
      typeSlug: s.typeSlug,
      productName: s.productName,
      autoProlong: s.autoProlong,
      locationCode: s.locationCode,
    },
  };
}

// Money-in transaction types are top-ups; everything else is a charge.
const TOPUP_TYPES = new Set(['replenishment', 'compensation', 'refund']);

function isTopup(t: AezaTransaction): boolean {
  return TOPUP_TYPES.has(t.type) || (t.type === 'manual' && t.amount >= 0);
}

function toAmount(minor: number): Decimal {
  return new Decimal(String(Math.abs(minor))).div(100);
}

// Map performed transactions to payments. Top-ups stay individual; charges are aggregated into one
// entry per day (Aeza's hourly billing emits a charge per service per hour, which would otherwise
// spam the journal), mirroring the Selectel consumption import.
export function mapAezaPayments(txns: AezaTransaction[], currency: string): PaymentData[] {
  const topups: PaymentData[] = [];
  const charges: AezaTransaction[] = [];
  for (const t of txns) {
    if (isTopup(t)) {
      topups.push({
        externalId: `txn:${t.id}`,
        type: 'topup',
        amount: toAmount(t.amount),
        currency,
        date: parseDate(t.performedAt ?? t.createdAt) ?? new Date(0),
        description: t.type,
      });
    } else {
      charges.push(t);
    }
  }
  return [...topups, ...aggregateChargesByDay(charges, currency)];
}

// Sum charges per calendar day (UTC), dropping days that net to zero (Aeza's free hourly prolongs
// show up as 0). Idempotent across re-syncs via the per-day externalId; the aggregate isn't tied to
// a single service.
export function aggregateChargesByDay(charges: AezaTransaction[], currency: string): PaymentData[] {
  const perDay = new Map<string, Decimal>();
  for (const t of charges) {
    const d = parseDate(t.performedAt ?? t.createdAt);
    if (!d) continue;
    const day = d.toISOString().slice(0, 10); // YYYY-MM-DD
    perDay.set(day, (perDay.get(day) ?? new Decimal(0)).add(toAmount(t.amount)));
  }
  const out: PaymentData[] = [];
  for (const [day, sum] of perDay) {
    if (sum.lte(0)) continue;
    out.push({
      externalId: `aeza:day:${day}`, // one charge per day; idempotent across re-syncs
      type: 'charge',
      amount: sum,
      currency,
      date: new Date(`${day}T00:00:00Z`),
      description: 'Aeza charges',
    });
  }
  return out;
}
