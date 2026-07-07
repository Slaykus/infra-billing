import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '@config/app-config.service';

/** One row from the receipts service GET /receipts response. */
export interface ReceiptItem {
  payment_id: string;
  amount: number;
  description: string;
  operation_time: string;
  status: string;
  receipt_uuid: string | null;
  receipt_link: string | null;
  created_at: string;
  sent_at: string | null;
}

interface ReceiptListResponse {
  items: ReceiptItem[];
  total: number;
}

const PAGE_SIZE = 200;
const REQUEST_TIMEOUT_MS = 15_000;

/** Read-only client for the Moy Nalog receipts service (income source). */
@Injectable()
export class MoyNalogClient {
  private readonly logger = new Logger(MoyNalogClient.name);

  constructor(private readonly config: AppConfigService) {}

  isConfigured(): boolean {
    return !!this.config.receiptsServiceUrl && !!this.config.receiptsServiceKey;
  }

  /** Fetch the whole receipt ledger, paging until exhausted. */
  async fetchAll(): Promise<ReceiptItem[]> {
    const base = this.config.receiptsServiceUrl;
    const key = this.config.receiptsServiceKey;
    if (!base || !key) throw new Error('Receipts service is not configured');
    const root = base.replace(/\/+$/, '');

    const out: ReceiptItem[] = [];
    let offset = 0;
    for (;;) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      let payload: ReceiptListResponse;
      try {
        const resp = await fetch(`${root}/receipts?limit=${PAGE_SIZE}&offset=${offset}`, {
          headers: { 'X-Service-Key': key },
          signal: controller.signal,
        });
        if (!resp.ok) throw new Error(`receipts service returned HTTP ${resp.status}`);
        payload = (await resp.json()) as ReceiptListResponse;
      } finally {
        clearTimeout(timer);
      }
      out.push(...payload.items);
      offset += payload.items.length;
      if (payload.items.length < PAGE_SIZE || offset >= payload.total) break;
    }
    return out;
  }
}
