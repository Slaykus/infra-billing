import Decimal from 'decimal.js';
import { PaymentData, ServiceData } from '../connector.interface';
import { VdsinaOperation, VdsinaServer } from './vdsina.types';

export const VDSINA_CURRENCY = 'RUB';

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

function primaryIp(ip: VdsinaServer['ip']): string | undefined {
  if (Array.isArray(ip)) {
    for (const item of ip) {
      if (typeof item === 'string' && item) return item;
      if (item && typeof item === 'object' && 'ip' in item && typeof item.ip === 'string') {
        return item.ip;
      }
    }
    return undefined;
  }
  return ip || undefined;
}

function countryCode(s: VdsinaServer): string | undefined {
  const country = s.datacenter?.country;
  return country && country.length === 2 ? country.toUpperCase() : undefined;
}

function period(plan: VdsinaServer['server-plan']): string {
  const raw = plan?.period;
  return raw ? (PERIOD_MAP[raw] ?? 'monthly') : 'monthly';
}

export function mapVdsinaServer(s: VdsinaServer): ServiceData {
  const plan = s['server-plan'] ?? s.server_plan;
  return {
    externalId: String(s.id),
    name: s.name || s.host || primaryIp(s.ip) || `vdsina-${s.id}`,
    type: 'vps',
    countryCode: countryCode(s),
    cost: asDecimal(plan?.cost),
    currency: VDSINA_CURRENCY,
    period: period(plan),
    nextBilling: parseDate(s.end ?? s.expire ?? s.expires ?? s.prolong),
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

export function mapVdsinaOperation(o: VdsinaOperation): PaymentData | null {
  // Only completed operations represent real money movement. Pending top-ups have paylink/status=0.
  if (o.status !== 1) return null;
  if (o.type !== 1 && o.type !== -1) return null;
  const amount = asDecimal(o.summ)?.abs();
  if (!amount || amount.lte(0)) return null;
  const serviceId = o.service?.id ? String(o.service.id) : undefined;
  return {
    externalId: `operation:${o.id}`,
    type: o.type === 1 ? 'topup' : 'charge',
    amount,
    currency: VDSINA_CURRENCY,
    date: parseDate(o.updated ?? o.created) ?? new Date(0),
    description: o.comment || o.payment?.name || undefined,
    serviceExternalId: serviceId,
  };
}
