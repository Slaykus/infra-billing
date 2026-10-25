import axios, { type AxiosInstance } from 'axios';
import Decimal from 'decimal.js';
import { REQUEST_TIMEOUT_MS } from '../common/http';
import { Account, Connector, ServiceData } from '../connector.interface';

const BASE_URL = 'https://api.deepseek.com';

/** One wallet per currency; amounts arrive as decimal strings. */
interface DeepseekBalanceInfo {
  currency: string;
  total_balance: string;
  granted_balance?: string;
  topped_up_balance?: string;
}

interface DeepseekBalanceResponse {
  is_available: boolean;
  balance_infos: DeepseekBalanceInfo[];
}

/**
 * DeepSeek API platform connector. Auth: the platform API key as a Bearer token (single string,
 * like vultr/linode). The only billing data the API exposes is `GET /user/balance`, which returns
 * one wallet per currency (CNY for accounts topped up in yuan, USD otherwise). The platform has no
 * resources to list, so there are no services — usage stays on the manually entered service.
 */
export class DeepseekConnector implements Connector {
  private readonly http: AxiosInstance;

  constructor(token: string) {
    this.http = axios.create({
      baseURL: BASE_URL,
      timeout: REQUEST_TIMEOUT_MS,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    this.http.interceptors.response.use(undefined, (e) => {
      if (axios.isAxiosError(e)) {
        const body = e.response?.data as { error?: { message?: string } } | string | undefined;
        const msg = typeof body === 'string' ? body : body?.error?.message;
        throw new Error(
          msg ? `DeepSeek: ${msg}` : `DeepSeek API error (HTTP ${e.response?.status ?? 'network'})`,
        );
      }
      throw e;
    });
  }

  kind(): string {
    return 'deepseek';
  }

  async fetchAccount(signal: AbortSignal): Promise<Account> {
    const { data } = await this.http.get<DeepseekBalanceResponse>('/user/balance', { signal });
    const wallets = (data.balance_infos ?? []).filter((w) => w.currency);
    // Prefer a USD wallet when both exist; otherwise the single wallet the account has.
    const wallet = wallets.find((w) => w.currency.toUpperCase() === 'USD') ?? wallets[0];
    if (!wallet) return { balance: null, currency: 'USD' };
    return {
      balance: new Decimal(wallet.total_balance || '0'),
      currency: wallet.currency.toUpperCase(),
    };
  }

  // No resources on the DeepSeek platform — nothing to sync as services.
  async fetchServices(): Promise<ServiceData[]> {
    return [];
  }
}
