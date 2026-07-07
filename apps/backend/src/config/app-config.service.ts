import { Injectable } from '@nestjs/common';
import { envSchema, type Env } from './env.schema';

/** Typed, validated access to environment configuration. */
@Injectable()
export class AppConfigService {
  readonly env: Env;

  constructor() {
    this.env = envSchema.parse(process.env);
  }

  get isProd(): boolean {
    return this.env.NODE_ENV === 'production';
  }

  get port(): number {
    return this.env.PORT;
  }

  get encryptionKey(): string {
    return this.env.ENCRYPTION_KEY;
  }

  get docs(): boolean {
    return this.env.DOCS;
  }

  get buildInfo(): {
    version: string;
    buildTime: string;
    gitCommit: string;
    nodeVersion: string;
    docs: boolean;
  } {
    return {
      version: this.env.APP_VERSION,
      buildTime: this.env.BUILD_TIME,
      gitCommit: this.env.GIT_COMMIT,
      nodeVersion: process.version,
      docs: this.env.DOCS,
    };
  }

  get receiptsServiceUrl(): string | undefined {
    return this.env.RECEIPTS_SERVICE_URL;
  }

  get receiptsServiceKey(): string | undefined {
    return this.env.RECEIPTS_SERVICE_KEY;
  }

  get receiptsCurrency(): string {
    return this.env.RECEIPTS_CURRENCY;
  }

  /** True only when income sync is enabled AND the source URL + key are configured. */
  get incomeSyncEnabled(): boolean {
    return (
      this.env.INCOME_SYNC_ENABLED &&
      !!this.env.RECEIPTS_SERVICE_URL &&
      !!this.env.RECEIPTS_SERVICE_KEY
    );
  }
}
