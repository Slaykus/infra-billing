import axios, { type AxiosInstance } from 'axios';
import Decimal from 'decimal.js';
import { REQUEST_TIMEOUT_MS } from '../common/http';
import { Account, Connector, PaymentData, ServiceData } from '../connector.interface';
import { VDSINA_CURRENCY, mapVdsinaOperation, mapVdsinaServer } from './vdsina.mapper';
import {
  VdsinaAccount,
  VdsinaBalance,
  VdsinaEnvelope,
  VdsinaOperation,
  VdsinaServer,
  VdsinaServerPlan,
} from './vdsina.types';

const BASE_URL = 'https://userapi.vdsina.ru';

/**
 * VDSina Public API (https://vdsina.ru/tech/api): JSON over HTTPS, token in the Authorization
 * header. The account balance is prepaid RUB (`real`; bonus/partner are kept in meta only),
 * servers are listed via /v1/server, and account operations import top-ups/charges.
 */
export class VdsinaConnector implements Connector {
  private readonly http: AxiosInstance;
  private readonly plansByGroup = new Map<number, Promise<VdsinaServerPlan[]>>();

  constructor(token: string) {
    this.http = axios.create({
      baseURL: BASE_URL,
      timeout: REQUEST_TIMEOUT_MS,
      headers: { Authorization: token },
    });
    this.http.interceptors.response.use(
      (res) => {
        const body = res.data as VdsinaEnvelope<unknown> | undefined;
        if (body?.status === 'error') {
          throw new Error(`VDSina: ${body.description || body.status_msg || 'API error'}`);
        }
        return res;
      },
      (e) => {
        if (axios.isAxiosError(e)) {
          const body = e.response?.data as VdsinaEnvelope<unknown> | undefined;
          const msg = body?.description || body?.status_msg;
          if (msg) throw new Error(`VDSina: ${msg}`);
        }
        throw e;
      },
    );
  }

  kind(): string {
    return 'vdsina';
  }

  async fetchAccount(signal: AbortSignal): Promise<Account> {
    const [{ data: balanceRes }] = await Promise.all([
      this.http.get<VdsinaEnvelope<VdsinaBalance>>('/v1/account.balance', { signal }),
      // Best-effort token/account probe; balance is the only field represented in Account.
      this.http
        .get<VdsinaEnvelope<VdsinaAccount>>('/v1/account', { signal })
        .catch(() => undefined),
    ]);
    return {
      balance: new Decimal(String(balanceRes.data?.real ?? 0)),
      currency: VDSINA_CURRENCY,
    };
  }

  async fetchServices(signal: AbortSignal): Promise<ServiceData[]> {
    const { data } = await this.http.get<VdsinaEnvelope<VdsinaServer[]>>('/v1/server', { signal });
    const services = (data.data ?? []).filter((s) => s.status !== 'deleted');
    const enriched = await Promise.all(services.map((s) => this.withDetails(s, signal)));
    return enriched.map(mapVdsinaServer);
  }

  async fetchPayments(signal: AbortSignal): Promise<PaymentData[]> {
    const { data } = await this.http.get<VdsinaEnvelope<VdsinaOperation[]>>('/v1/operation', {
      signal,
    });
    return (data.data ?? []).map(mapVdsinaOperation).filter((p): p is PaymentData => p !== null);
  }

  /** The list endpoint can omit fields; fill them from the detail endpoint when useful. */
  private async withDetails(server: VdsinaServer, signal: AbortSignal): Promise<VdsinaServer> {
    const plan = server['server-plan'] ?? server.server_plan;
    if (plan?.cost && (server.end || server.expire || server.expires)) {
      return server;
    }
    try {
      const { data } = await this.http.get<VdsinaEnvelope<VdsinaServer>>(
        `/v1/server/${server.id}`,
        {
          signal,
        },
      );
      const detailed = { ...server, ...data.data };
      return await this.withPlanPrice(detailed, signal);
    } catch {
      return server;
    }
  }

  /** Server detail includes only plan id/name; price/period live in /v1/server-plan/{groupId}. */
  private async withPlanPrice(server: VdsinaServer, signal: AbortSignal): Promise<VdsinaServer> {
    const plan = server['server-plan'] ?? server.server_plan;
    if (!plan?.id || plan.cost) return server;
    const group = server['server-group'] ?? server.server_group;
    if (!group?.id) return server;

    const plans = await this.fetchPlans(group.id, signal);
    const priced = plans.find((p) => p.id === plan.id);
    if (!priced) return server;

    return {
      ...server,
      'server-plan': { ...priced, ...plan, cost: priced.cost, period: priced.period },
      server_plan: undefined,
    };
  }

  private async fetchPlans(groupId: number, signal: AbortSignal): Promise<VdsinaServerPlan[]> {
    let promise = this.plansByGroup.get(groupId);
    if (!promise) {
      promise = this.http
        .get<VdsinaEnvelope<VdsinaServerPlan[]>>(`/v1/server-plan/${groupId}`, { signal })
        .then((res) => res.data.data ?? [])
        .catch(() => []);
      this.plansByGroup.set(groupId, promise);
    }
    return promise;
  }
}
