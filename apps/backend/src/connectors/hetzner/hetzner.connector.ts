import axios, { type AxiosInstance } from 'axios';
import { REQUEST_TIMEOUT_MS } from '../common/http';
import { Account, Connector, ServiceData } from '../connector.interface';
import { mapHetznerServer } from './hetzner.mapper';
import { HetznerServersResponse } from './hetzner.types';

const BASE_URL = 'https://api.hetzner.cloud/v1';
const PER_PAGE = 50;

/**
 * Hetzner Cloud connector, REST API (https://docs.hetzner.cloud). No maintained
 * npm SDK (official is Go-only; `hcloud-js` is stale), so we use a thin axios client.
 * Auth: Bearer <API_TOKEN>. The Cloud API has NO account balance, and billing is
 * hourly (price_hourly is sub-cent); we store the monthly cap (price_monthly, EUR)
 * and keep the hourly rate in meta.
 */
export class HetznerConnector implements Connector {
  private readonly http: AxiosInstance;

  constructor(token: string) {
    this.http = axios.create({
      baseURL: BASE_URL,
      timeout: REQUEST_TIMEOUT_MS,
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  kind(): string {
    return 'hetzner';
  }

  // Hetzner Cloud has no account balance endpoint.
  async fetchAccount(_signal: AbortSignal): Promise<Account> {
    return { balance: null, currency: 'EUR' };
  }

  async fetchServices(signal: AbortSignal): Promise<ServiceData[]> {
    const out: ServiceData[] = [];
    let page = 1;
    for (;;) {
      const { data } = await this.http.get<HetznerServersResponse>('/servers', {
        params: { page, per_page: PER_PAGE },
        signal,
      });
      for (const s of data.servers ?? []) out.push(mapHetznerServer(s));
      const next = data.meta?.pagination?.next_page;
      if (!next) break;
      page = next;
    }
    return out;
  }
}
