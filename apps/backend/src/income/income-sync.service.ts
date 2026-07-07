import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import Decimal from 'decimal.js';
import { IncomeSyncResult } from '@infra/shared';
import { IncomeEntriesRepository } from '@repositories/income-entries/income-entries.repository';
import { AppConfigService } from '@config/app-config.service';
import { MoyNalogClient } from './moy-nalog.client';

const SYNC_INTERVAL_MS = 3_600_000; // hourly

@Injectable()
export class IncomeSyncService implements OnModuleInit {
  private readonly logger = new Logger(IncomeSyncService.name);
  private running = false;

  constructor(
    private readonly repo: IncomeEntriesRepository,
    private readonly client: MoyNalogClient,
    private readonly config: AppConfigService,
  ) {}

  onModuleInit(): void {
    if (this.config.incomeSyncEnabled) {
      void this.sync();
    }
  }

  @Interval('income-sync', SYNC_INTERVAL_MS)
  async scheduled(): Promise<void> {
    if (!this.config.incomeSyncEnabled) return;
    await this.sync();
  }

  /** Pull the receipt ledger and upsert income entries. Safe to call manually. */
  async sync(): Promise<IncomeSyncResult> {
    if (this.running) {
      return { fetched: 0, upserted: 0, ok: false, error: 'sync already running' };
    }
    if (!this.client.isConfigured()) {
      return { fetched: 0, upserted: 0, ok: false, error: 'receipts service not configured' };
    }
    this.running = true;
    const currency = this.config.receiptsCurrency;
    try {
      const items = await this.client.fetchAll();
      let upserted = 0;
      for (const r of items) {
        await this.repo.upsertExternal('moy-nalog', r.payment_id, {
          amount: new Decimal(r.amount).toFixed(2),
          currency,
          description: r.description || null,
          incomeDate: new Date(r.operation_time),
          status: r.status,
          receiptLink: r.receipt_link || null,
        });
        upserted += 1;
      }
      this.logger.log(`Income sync: fetched ${items.length}, upserted ${upserted}`);
      return { fetched: items.length, upserted, ok: true, error: null };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`Income sync failed: ${msg}`);
      return { fetched: 0, upserted: 0, ok: false, error: msg };
    } finally {
      this.running = false;
    }
  }
}
