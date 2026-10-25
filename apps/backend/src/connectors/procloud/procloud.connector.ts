import axios, { type AxiosInstance } from 'axios';
import Decimal from 'decimal.js';
import { REQUEST_TIMEOUT_MS } from '../common/http';
import { totpCode } from '../common/totp';
import { Account, Connector, ServiceData } from '../connector.interface';

const PANEL_URL = 'https://my.procloud.ru';
// Keycloak realm behind the panel; the SPA's public client "web" allows the direct (password) grant.
const TOKEN_URL = 'https://login.procloud.ru/auth/realms/procloud/protocol/openid-connect/token';
const CLIENT_ID = 'web';
const PROCLOUD_CURRENCY = 'RUB';

export interface ProcloudCredentials {
  username: string; // login email
  password: string;
  totpSecret?: string;
}

interface ProcloudAccount {
  id: string;
  externalId: string;
  accountNumber?: string;
  name?: string;
  isActive?: boolean;
  isBlocked?: boolean;
}

interface ProcloudBillingSummary {
  balance: number;
  /** Consumption accrued in the current period, charged on `billingDate`. */
  unbilledAmount?: number;
  creditLimit?: number;
  billingDate?: string;
  billingStatus?: string;
}

interface ProcloudError {
  errorCode?: string;
  error?: string;
  error_description?: string;
}

/**
 * ProCloud (my.procloud.ru) connector. There is no public API: this talks to the same backend the
 * control panel uses. Auth is the panel's Keycloak realm via the password grant (email + password,
 * plus a TOTP code when 2FA is on); the bearer token is short-lived, so each sync logs in afresh.
 *
 * The panel scopes every billing call to a contract: the `X-Account-Id` header and the `accountId`
 * query both carry the account's `externalId` from `GET /api/account`.
 *
 * Balance semantics: ProCloud is pay-as-you-go. `balance` is the prepaid amount, while
 * `unbilledAmount` is consumption already accrued this period and charged on the billing date.
 * We report `balance - unbilledAmount` — what is actually still available — so low-balance alerts
 * and the runway estimate track real spending instead of jumping once a month.
 *
 * Cloud resources aren't mapped to services (none are synced); the cost stays on the manual service.
 */
export class ProcloudConnector implements Connector {
  private readonly http: AxiosInstance;

  constructor(private readonly creds: ProcloudCredentials) {
    this.http = axios.create({ baseURL: PANEL_URL, timeout: REQUEST_TIMEOUT_MS });
    this.http.interceptors.response.use(undefined, (e) => {
      if (axios.isAxiosError(e)) {
        const body = e.response?.data as ProcloudError | undefined;
        const msg = body?.errorCode || body?.error_description || body?.error;
        throw new Error(
          msg ? `ProCloud: ${msg}` : `ProCloud API error (HTTP ${e.response?.status ?? 'network'})`,
        );
      }
      throw e;
    });
  }

  kind(): string {
    return 'procloud';
  }

  async fetchAccount(signal: AbortSignal): Promise<Account> {
    const token = await this.login(signal);
    const auth = { Authorization: `Bearer ${token}`, Accept: 'application/json' };

    const { data: accounts } = await this.http.get<ProcloudAccount[]>('/api/account', {
      headers: auth,
      signal,
    });
    const account = accounts.find((a) => a.isActive && !a.isBlocked) ?? accounts[0];
    if (!account) throw new Error('ProCloud: no contract found for this login');

    const { data } = await this.http.get<ProcloudBillingSummary>('/api/dashboard/billing', {
      headers: { ...auth, 'X-Account-Id': account.externalId },
      params: { accountId: account.externalId },
      signal,
    });
    const available = new Decimal(String(data.balance ?? 0)).minus(
      String(data.unbilledAmount ?? 0),
    );
    return { balance: available, currency: PROCLOUD_CURRENCY };
  }

  async fetchServices(): Promise<ServiceData[]> {
    return [];
  }

  private async login(signal: AbortSignal): Promise<string> {
    const form = new URLSearchParams({
      grant_type: 'password',
      client_id: CLIENT_ID,
      scope: 'openid',
      username: this.creds.username,
      password: this.creds.password,
    });
    if (this.creds.totpSecret) form.set('totp', totpCode(this.creds.totpSecret, Date.now()));
    try {
      const { data } = await axios.post<{ access_token: string }>(TOKEN_URL, form.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: REQUEST_TIMEOUT_MS,
        signal,
      });
      return data.access_token;
    } catch (e) {
      if (axios.isAxiosError(e)) {
        const body = e.response?.data as ProcloudError | undefined;
        if (body?.error === 'invalid_grant') {
          throw new Error(
            this.creds.totpSecret
              ? 'ProCloud: wrong email, password or TOTP secret'
              : 'ProCloud: wrong email or password (or 2FA is on and the TOTP secret is missing)',
          );
        }
        throw new Error(`ProCloud login failed: ${body?.error_description || body?.error || e.message}`);
      }
      throw e;
    }
  }
}
