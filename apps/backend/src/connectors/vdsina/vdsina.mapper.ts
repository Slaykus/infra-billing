import Decimal from 'decimal.js';
import { PaymentData, ServiceData } from '../connector.interface';
import { VdsinaOperation, VdsinaServer } from './vdsina.types';

const PERIOD_MAP: Record<string, string> = {
  day: 'daily',
  daily: 'daily',
  month: 'monthly',
  monthly: 'monthly',
  year: 'yearly',
  yearly: 'yearly',
};

function asDecimal(value: string | number | undefined): Decimal | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return new Decimal(String(value));
}

function parseDate(value?: string): Date | undefined {
  if (!value) return undefined;
  // VDSina documents Europe/Moscow timestamps as "YYYY-MM-DD HH:mm:ss"; the date-only fields work
  // with this path too. The app stores Dates as instants, so make parsing explicit and stable.
  let normalized = value.replace(' ', 'T');
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) normalized = `${normalized}T00:00:00`;
  if (!/(Z|[+-]\d{2}:?\d{2})$/.test(normalized)) normalized = `${normalized}+03:00`;
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

// Live responses return `ip` as a single object; keep the array/string forms defensively.
function primaryIp(ip: VdsinaServer['ip']): string | undefined {
  for (const item of Array.isArray(ip) ? ip : [ip]) {
    if (typeof item === 'string' && item) return item;
    if (item && typeof item === 'object' && typeof item.ip === 'string') return item.ip;
  }
  return undefined;
}

function countryCode(s: VdsinaServer): string | undefined {
  const country = s.datacenter?.country;
  return country && country.length === 2 ? country.toUpperCase() : undefined;
}

// Unknown/absent plan period stays undefined: a false "monthly" next to a per-day price would
// skew normalization ~30x, and the sync only overwrites the stored period when one is emitted.
function period(plan: VdsinaServer['server-plan']): string | undefined {
  const raw = plan?.period;
  return raw ? PERIOD_MAP[raw] : undefined;
}

export function mapVdsinaServer(s: VdsinaServer, currency: string): ServiceData {
  const plan = s['server-plan'];
  return {
    externalId: String(s.id),
    name: s.name || s.host || primaryIp(s.ip) || `vdsina-${s.id}`,
    type: 'vps',
    countryCode: countryCode(s),
    cost: asDecimal(plan?.cost),
    currency,
    period: period(plan),
    nextBilling: parseDate(s.end),
    meta: {
      ip: s.ip,
      host: s.host,
      status: s.status,
      statusText: s.status_text,
      datacenter: s.datacenter,
      plan,
      template: s.template,
      autoprolong: s.autoprolong,
      created: s.created,
    },
  };
}

export function mapVdsinaOperation(o: VdsinaOperation, currency: string): PaymentData | null {
  // Only completed operations represent real money movement. Pending top-ups have paylink/status=0.
  if (o.status !== 1) return null;
  if (o.type !== 1 && o.type !== -1) return null;
  // Bonus/partner purses are not money out of pocket — count only the main balance, matching
  // fetchAccount which reports balance.real. Rows without the field still import.
  if (o.purse && o.purse !== 'real') return null;
  const amount = asDecimal(o.summ)?.abs();
  if (!amount || amount.lte(0)) return null;
  const serviceId = o.service?.id ? String(o.service.id) : undefined;
  return {
    externalId: `operation:${o.id}`,
    type: o.type === 1 ? 'topup' : 'charge',
    amount,
    currency,
    date: parseDate(o.updated ?? o.created) ?? new Date(0),
    description: o.comment || o.payment?.name || undefined,
    serviceExternalId: serviceId,
  };
}
