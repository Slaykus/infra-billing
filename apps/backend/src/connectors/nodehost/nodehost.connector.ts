import axios from 'axios';
import Decimal from 'decimal.js';
import { REQUEST_TIMEOUT_MS } from '../common/http';
import { Account, Connector, ServiceData } from '../connector.interface';

interface NodehostStatus {
  ok: boolean;
  error?: string;
  balance?: number;
  currency?: string;
  /** Price to renew every active server for 30 days. */
  renewAll30?: number | null;
  servers?: { name: string; expiresAt: string }[];
  fetchedAt?: string;
}

/**
 * NodeHost connector. NodeHost has no API and no web cabinet — the account lives in the
 * @nodehost_bot Telegram bot. A separate worker (`nodehost-checker`, deployed next to the panel)
 * holds the owner's Telegram user session, asks the bot for the profile at most every few hours and
 * exposes the parsed numbers on the internal Docker network. The Telegram session never reaches the
 * panel: the stored "token" is just that worker's status URL with its access key.
 *
 * Services: one per active server, with the expiry date as the next charge. The bot only prints
 * the renewal price for all servers together, so the cost is filled in only when there is exactly
 * one server (otherwise it stays as entered manually).
 */
export class NodehostConnector implements Connector {
  private cached?: Promise<NodehostStatus>;

  constructor(private readonly statusUrl: string) {}

  kind(): string {
    return 'nodehost';
  }

  async fetchAccount(signal: AbortSignal): Promise<Account> {
    const s = await this.status(signal);
    return { balance: new Decimal(String(s.balance ?? 0)), currency: s.currency || 'USD' };
  }

  async fetchServices(signal: AbortSignal): Promise<ServiceData[]> {
    const s = await this.status(signal);
    const servers = s.servers ?? [];
    const single = servers.length === 1 && s.renewAll30 != null;
    return servers.map((srv, i) => {
      const next = new Date(srv.expiresAt);
      return {
        // The bot gives servers no id; their order in the profile is stable.
        externalId: `server-${i + 1}`,
        name: srv.name,
        type: 'vps',
        ...(single
          ? { cost: new Decimal(String(s.renewAll30)), currency: 'USD', period: 'monthly' }
          : {}),
        nextBilling: Number.isNaN(next.getTime()) ? null : next,
        meta: { source: '@nodehost_bot', fetchedAt: s.fetchedAt },
      };
    });
  }

  /** One worker call per sync run (account + services share it). */
  private status(signal: AbortSignal): Promise<NodehostStatus> {
    this.cached ??= this.load(signal);
    return this.cached;
  }

  private async load(signal: AbortSignal): Promise<NodehostStatus> {
    try {
      const { data } = await axios.get<NodehostStatus>(this.statusUrl, {
        // The worker may have to ask the bot first (tunnel + Telegram round trip).
        timeout: Math.max(REQUEST_TIMEOUT_MS, 90_000),
        signal,
        validateStatus: () => true,
      });
      if (!data?.ok) throw new Error(`NodeHost checker: ${data?.error || 'no data'}`);
      return data;
    } catch (e) {
      if (axios.isAxiosError(e)) throw new Error(`NodeHost checker unreachable: ${e.message}`);
      throw e;
    }
  }
}
