import { normalizeCurrency } from '../common/currency';

// BILLmanager renders scalars as { "$": "value" } and sometimes arrays of them.
export function val(x: unknown): string | undefined {
  if (x == null) return undefined;
  if (Array.isArray(x)) return x.length ? val(x[0]) : undefined;
  if (typeof x === 'object') {
    const v = (x as Record<string, unknown>).$;
    return v == null ? undefined : String(v);
  }
  return String(x);
}

export function firstNumber(s: string | undefined): string | undefined {
  return s?.match(/-?\d+(\.\d+)?/)?.[0];
}

export function asArray(raw: unknown): unknown[] {
  return Array.isArray(raw) ? raw : raw ? [raw] : [];
}

// Currency from an amount string like "5.00 $" / "49.99 руб.": strip the number, keep the symbol.
export function currencyFromAmount(s: string | undefined): string {
  return normalizeCurrency((s ?? '').replace(/[\d.,\s+-]/g, ''));
}

// func=payment renders `status` as a localized display name ("Зачислен"/"Paid"); other states
// like "Новый"/"Отменён" are not real top-ups. Verified live: akenai (en) returns "Paid".
const CREDITED_PAYMENT_STATUSES = new Set([
  'зачислен',
  'зачислено',
  'оплачен',
  'оплачено',
  'проведен',
  'проведён',
  'paid',
]);

// Whether a func=payment record counts as a completed top-up. A missing status is treated as
// importable (older installs / records that omit it), so only an explicit non-credited status
// (e.g. "Новый"/"Отменён") is filtered out.
export function isPaymentCredited(status: string | undefined): boolean {
  if (!status) return true;
  return CREDITED_PAYMENT_STATUSES.has(status.trim().toLowerCase());
}

// BILLmanager dates are ISO-ish ("2026-06-06"); undefined when missing/unparseable.
export function parseBillmgrDate(s: string | undefined): Date | undefined {
  if (!s) return undefined;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

// BILLmanager error → short human message (msg/detail/$object), not the raw JSON.
export function billmgrError(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>;
    return (
      val(e.msg) ?? val(e.detail) ?? (e.$object != null ? String(e.$object) : undefined) ?? 'error'
    );
  }
  return String(err);
}
