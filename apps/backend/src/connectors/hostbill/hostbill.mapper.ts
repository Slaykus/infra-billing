import Decimal from 'decimal.js';
import { normalizeCurrency } from '../common/currency';
import { PaymentData, ServiceData } from '../connector.interface';
import { HostbillInvoice, HostbillInvoiceDetail, HostbillService } from './hostbill.types';

/** HostBill defaults to USD when the currency label isn't recognized (used by the connector too). */
export const HOSTBILL_FALLBACK_CURRENCY = 'USD';

const SKIP_STATUSES = new Set(['cancelled', 'terminated', 'fraud']);

/** Active services only: cancelled/terminated/fraud are not current expenses. */
export function isActiveHostbillService(s: HostbillService): boolean {
  return !SKIP_STATUSES.has((s.status ?? '').toLowerCase());
}

// HostBill dates: "2026-05-24" or "2026-05-24 00:42:28"; "0000-00-00…" means unset.
function parseInvoiceDate(s?: string): Date | undefined {
  const day = (s ?? '').split(' ')[0];
  if (!day || day.startsWith('0000')) return undefined;
  const d = new Date(day);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

// Cycles we don't model (semi-annual/biennial/triennial) → monthly-equivalent cost.
function resolveBilling(cycle: string, total: string): { period: string; cost: Decimal } {
  const t = new Decimal(total || 0);
  switch (cycle) {
    case 'Monthly':
      return { period: 'monthly', cost: t };
    case 'Quarterly':
      return { period: 'quarterly', cost: t };
    case 'Annually':
      return { period: 'yearly', cost: t };
    case 'One Time':
    case 'Free':
      return { period: 'onetime', cost: t };
    case 'Semi-Annually':
      return { period: 'monthly', cost: t.div(6) };
    case 'Biennially':
      return { period: 'monthly', cost: t.div(24) };
    case 'Triennially':
      return { period: 'monthly', cost: t.div(36) };
    default:
      return { period: 'monthly', cost: t };
  }
}

export function mapHostbillService(s: HostbillService): ServiceData {
  const { period, cost } = resolveBilling(s.billingcycle ?? 'Monthly', s.total ?? '0');
  return {
    externalId: String(s.id),
    name: s.name || s.domain || `service-${s.id}`,
    type: 'vps',
    cost,
    period,
    nextBilling: s.next_due ? new Date(s.next_due) : undefined,
    meta: { ...s },
  };
}

export function isPaidInvoice(inv: HostbillInvoice): boolean {
  return (inv.status ?? '').toLowerCase() === 'paid';
}

/**
 * Map a PAID HostBill invoice to a payment (type=topup, dated by datepaid). Returns null for
 * unpaid invoices or ones without a usable date. They aren't payment facts. The amount is what
 * was actually paid in (`detail.total`), so an invoice settled from the account balance is
 * skipped: that money was already counted by the invoice that topped the balance up. Without a
 * detail the list's gross total is used. Payments stay provider-level (no serviceExternalId).
 */
export function invoiceToPayment(
  inv: HostbillInvoice,
  detail?: HostbillInvoiceDetail,
): PaymentData | null {
  if (!isPaidInvoice(inv)) return null;
  const date = parseInvoiceDate(inv.datepaid) ?? parseInvoiceDate(inv.date);
  if (!date) return null;
  const amount = new Decimal(String(detail?.total ?? inv.total ?? inv.subtotal ?? 0));
  if (amount.lte(0) && new Decimal(String(detail?.credit ?? 0)).gt(0)) return null;
  return {
    externalId: `invoice:${inv.id}`,
    type: 'topup',
    amount,
    currency: normalizeCurrency(inv.currency, HOSTBILL_FALLBACK_CURRENCY),
    date,
    description: `Invoice ${inv.number ?? inv.id}`,
  };
}
