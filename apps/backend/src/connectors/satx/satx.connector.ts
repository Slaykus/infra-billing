import axios, { type AxiosInstance } from 'axios';
import Decimal from 'decimal.js';
import { REQUEST_TIMEOUT_MS } from '../common/http';
import { Account, Connector, ServiceData } from '../connector.interface';

const BASE_URL = 'https://satx.cloud';
// Prices are quoted in rubles (`monthly`, `monthlyRub`, `upgradeCostRub` in the spec).
const SATX_CURRENCY = 'RUB';
// The API allows 1 request per second per IP; space calls out a little above that.
const MIN_INTERVAL_MS = 1100;
const MAX_RATE_RETRIES = 3;

interface SatxServerListItem {
  vmid: number;
  name: string;
  type?: 'vds' | 'lxc';
  status?: string;
  cores?: number;
  memoryMb?: number;
  diskGb?: number;
  primaryIp?: string | null;
  ipv4?: string[];
  createdAt?: string;
  /** Next charge date. */
  endingAt?: string | null;
  suspended?: boolean;
}

interface SatxServerDetail extends SatxServerListItem {
  billing?: { planId?: string | null; monthly?: number | null; nextPaymentAt?: string | null };
}

interface SatxEnvelope {
  success: boolean;
  error?: string;
  message?: string;
  retryAfter?: number;
}

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(t);
      reject(signal.reason ?? new Error('aborted'));
    }, { once: true });
  });

const toDate = (s?: string | null): Date | null => {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};

/**
 * SatxCloud connector, built against the public OpenAPI spec (https://docs.satx.cloud/swagger.yaml).
 * Auth: the panel API key in the `X-API-Key` header (single string, like netlen/stormwall).
 *
 * The API exposes no account balance (only "pay from balance" actions), so `fetchAccount` returns
 * `balance: null`. What it does expose is exactly what payment control needs: per server, the
 * monthly price (`billing.monthly`, rubles) and the next charge date (`billing.nextPaymentAt`,
 * falling back to the list item's `endingAt`). The list endpoint omits `billing`, so each server is
 * fetched once more by `vmid`.
 *
 * Rate limit: 1 request/second per IP (`API_RATE_LIMIT`, with `retryAfter` seconds). Requests are
 * therefore sequential and spaced out, and a rate-limited call is retried after `retryAfter`.
 */
export class SatxConnector implements Connector {
  private readonly http: AxiosInstance;
  private lastCallAt = 0;

  constructor(token: string) {
    this.http = axios.create({
      baseURL: BASE_URL,
      timeout: REQUEST_TIMEOUT_MS,
      headers: { 'X-API-Key': token, Accept: 'application/json' },
    });
    // Errors are `{ success: false, error: CODE, message }` (e.g. API_KEY_INVALID).
    this.http.interceptors.response.use(undefined, (e) => {
      if (axios.isAxiosError(e)) {
        const body = e.response?.data as SatxEnvelope | undefined;
        if (body?.error === 'API_RATE_LIMIT') return Promise.reject(new RateLimited(body.retryAfter));
        const msg = body?.message || body?.error;
        throw new Error(
          msg ? `SatxCloud: ${msg}` : `SatxCloud API error (HTTP ${e.response?.status ?? 'network'})`,
        );
      }
      throw e;
    });
  }

  kind(): string {
    return 'satx';
  }

  // No balance endpoint in the API (verified against the full spec).
  async fetchAccount(): Promise<Account> {
    return { balance: null, currency: SATX_CURRENCY };
  }

  async fetchServices(signal: AbortSignal): Promise<ServiceData[]> {
    const data = await this.get<SatxEnvelope & { servers?: SatxServerListItem[] }>(
      '/api/servers-management/servers',
      signal,
    );
    if (!data.success) throw new Error(`SatxCloud: ${data.message || data.error || 'request failed'}`);
    const out: ServiceData[] = [];
    // Sequential on purpose: the per-IP rate limit makes parallel detail calls fail.
    for (const s of data.servers ?? []) out.push(await this.withBilling(s, signal));
    return out;
  }

  /** Rate-limit-aware GET: keeps calls >= MIN_INTERVAL_MS apart and retries API_RATE_LIMIT. */
  private async get<T>(url: string, signal: AbortSignal): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      const wait = this.lastCallAt + MIN_INTERVAL_MS - Date.now();
      if (wait > 0) await sleep(wait, signal);
      this.lastCallAt = Date.now();
      try {
        return (await this.http.get<T>(url, { signal })).data;
      } catch (e) {
        if (!(e instanceof RateLimited) || attempt >= MAX_RATE_RETRIES) {
          throw e instanceof RateLimited ? new Error('SatxCloud: API rate limit exceeded') : e;
        }
        await sleep(Math.max(1, e.retryAfter ?? 1) * 1000, signal);
      }
    }
  }

  /** Enrich a list item with its billing block; on a detail failure keep what the list gave. */
  private async withBilling(item: SatxServerListItem, signal: AbortSignal): Promise<ServiceData> {
    let s: SatxServerDetail = item;
    try {
      const data = await this.get<SatxEnvelope & { server?: SatxServerDetail }>(
        `/api/servers-management/servers/${item.vmid}`,
        signal,
      );
      if (data.success && data.server) s = { ...item, ...data.server };
    } catch (e) {
      if (signal.aborted) throw e;
    }
    const monthly = s.billing?.monthly;
    return {
      externalId: String(s.vmid),
      name: s.name || `vmid ${s.vmid}`,
      type: 'vps',
      ...(monthly != null
        ? { cost: new Decimal(String(monthly)), currency: SATX_CURRENCY, period: 'monthly' }
        : {}),
      nextBilling: toDate(s.billing?.nextPaymentAt) ?? toDate(s.endingAt),
      meta: {
        vmid: s.vmid,
        virt: s.type,
        status: s.status,
        suspended: s.suspended,
        cores: s.cores,
        memoryMb: s.memoryMb,
        diskGb: s.diskGb,
        primaryIp: s.primaryIp,
        ipv4: s.ipv4,
        planId: s.billing?.planId ?? null,
        createdAt: s.createdAt,
      },
    };
  }
}

class RateLimited extends Error {
  constructor(readonly retryAfter?: number) {
    super('SatxCloud: API rate limit');
  }
}
