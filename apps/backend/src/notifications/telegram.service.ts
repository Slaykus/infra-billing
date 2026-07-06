import { Injectable, Logger } from '@nestjs/common';
import { Api } from 'grammy';
import { SettingsRepository } from '@repositories/settings/settings.repository';
import { CryptoService } from '../crypto/crypto.service';

interface TelegramConfig {
  token: string;
  chatId: string;
  topicId: string;
}

// Outbound-only: grammY `Api`, no Bot/polling/webhook. Config (token AES-GCM encrypted) read from
// panel settings on every send so edits apply without a restart. No env fallback. Settings in DB.
@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  constructor(
    private readonly settings: SettingsRepository,
    private readonly crypto: CryptoService,
  ) {}

  /** Effective Telegram config (token/chat) from the panel settings; null if not configured. */
  private resolveConfig(
    s: {
      telegramBotTokenEnc: Uint8Array | null;
      telegramChatId: string | null;
      telegramTopicId: string | null;
    } | null,
  ): TelegramConfig | null {
    if (s?.telegramBotTokenEnc && s.telegramChatId) {
      try {
        return {
          token: this.crypto.decrypt(s.telegramBotTokenEnc),
          chatId: s.telegramChatId,
          topicId: s.telegramTopicId ?? '',
        };
      } catch {
        this.logger.error('Failed to decrypt the Telegram token from settings');
      }
    }
    return null;
  }

  /** Automatic notifications are on only when the master switch is on AND config exists. */
  async isEnabled(): Promise<boolean> {
    const s = await this.settings.find();
    if (s && !s.notificationsEnabled) return false;
    return this.resolveConfig(s) !== null;
  }

  /** Send a message. Ignores the master switch (used by the manual "test" too). */
  async send(html: string): Promise<boolean> {
    const s = await this.settings.find();
    const cfg = this.resolveConfig(s);
    if (!cfg) return false;
    const options: {
      parse_mode: 'HTML';
      message_thread_id?: number;
      link_preview_options: { is_disabled: true };
    } = { parse_mode: 'HTML', link_preview_options: { is_disabled: true } };
    if (cfg.topicId) options.message_thread_id = Number(cfg.topicId);
    try {
      await new Api(cfg.token).sendMessage(cfg.chatId, html, options);
      return true;
    } catch (e) {
      this.logger.error(
        'Failed to send the Telegram notification',
        e instanceof Error ? e.stack : String(e),
      );
      return false;
    }
  }
}
