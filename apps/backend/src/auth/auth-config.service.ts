import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { Prisma } from '@generated/prisma/client';
import type { AuthConfig as AuthConfigDto, SetupStatus, UpdateAuthConfig } from '@infra/shared';
import { AuthConfigRepository } from '@repositories/auth-config/auth-config.repository';
import { PasskeysRepository } from '@repositories/passkeys/passkeys.repository';
import { CryptoService } from '../crypto/crypto.service';
import { hashPassword } from './password.util';

// The singleton AuthConfig row (id=1) at runtime. Bytes columns come back as Uint8Array.
type AuthConfigRow = Prisma.AuthConfigGetPayload<Record<string, never>>;
type TelegramFields = Pick<
  AuthConfigRow,
  | 'telegramEnabled'
  | 'telegramClientId'
  | 'telegramClientSecretEnc'
  | 'telegramOrigin'
  | 'telegramUserId'
>;

/** What the sign-in lockout guard looks at, always with the values as they would be saved. */
export interface SignInMethods {
  passwordEnabled: boolean;
  passkeyEnabled: boolean;
  passkeyCount: number;
  telegramUsable: boolean;
}

/** Decrypted Telegram OIDC client settings. */
export interface TelegramClient {
  clientId: string;
  clientSecret: string;
  origin: string;
}

@Injectable()
export class AuthConfigService {
  // Session JWT secret, cached after first read so the guard doesn't hit the DB per request.
  private cachedSecret: string | null = null;

  constructor(
    private readonly repo: AuthConfigRepository,
    private readonly passkeys: PasskeysRepository,
    private readonly crypto: CryptoService,
  ) {}

  /** The admin config row, or null when no admin has been set up yet. */
  getRow(): Promise<AuthConfigRow | null> {
    return this.repo.find();
  }

  async requireRow(): Promise<AuthConfigRow> {
    const row = await this.getRow();
    if (!row) throw new UnauthorizedException('Admin account is not configured');
    return row;
  }

  async needsSetup(): Promise<boolean> {
    return (await this.repo.count()) === 0;
  }

  /** Public bootstrap status driving the login/setup screen. */
  async getStatus(): Promise<SetupStatus> {
    const row = await this.getRow();
    if (!row) {
      return {
        needsSetup: true,
        passwordEnabled: false,
        passkeyEnabled: false,
        telegramEnabled: false,
      };
    }
    return {
      needsSetup: false,
      passwordEnabled: row.passwordEnabled,
      passkeyEnabled: row.passkeyEnabled,
      // The login page only offers Telegram when it would actually work.
      telegramEnabled: this.telegramUsable(row),
    };
  }

  /** Create the single admin account (first run). Fails if one already exists. */
  async setup(username: string, password: string): Promise<void> {
    if (!(await this.needsSetup())) {
      throw new ConflictException('Admin account is already configured');
    }
    const secret = randomBytes(32).toString('hex');
    await this.repo.create({
      username,
      passwordHash: hashPassword(password),
      passwordEnabled: true,
      passkeyEnabled: false,
      sessionSecretEnc: this.crypto.encrypt(secret),
      webauthnUserId: Uint8Array.from(randomBytes(32)),
    });
    this.cachedSecret = secret;
  }

  async getConfig(): Promise<AuthConfigDto> {
    const row = await this.requireRow();
    return {
      username: row.username,
      passwordEnabled: row.passwordEnabled,
      passkeyEnabled: row.passkeyEnabled,
      rpId: row.rpId ?? '',
      rpName: row.rpName ?? '',
      rpOrigin: row.rpOrigin ?? '',
      telegramEnabled: row.telegramEnabled,
      telegramClientId: row.telegramClientId ?? '',
      hasTelegramClientSecret: !!row.telegramClientSecretEnc,
      telegramOrigin: row.telegramOrigin ?? '',
      telegramUserId: row.telegramUserId ?? '',
      telegramDisplayName: row.telegramDisplayName ?? '',
    };
  }

  async patchConfig(dto: UpdateAuthConfig): Promise<AuthConfigDto> {
    const row = await this.requireRow();
    const passwordEnabled = dto.passwordEnabled ?? row.passwordEnabled;
    const passkeyEnabled = dto.passkeyEnabled ?? row.passkeyEnabled;

    // Telegram values after the patch. Empty client ID / origin clear the field; an empty or
    // omitted secret keeps the stored one (it is write-only).
    const telegramClientId =
      dto.telegramClientId !== undefined ? dto.telegramClientId || null : row.telegramClientId;
    const telegramOrigin =
      dto.telegramOrigin !== undefined ? dto.telegramOrigin || null : row.telegramOrigin;
    const newSecret = dto.telegramClientSecret || null;
    // New client settings invalidate the link: re-linking proves they work end to end before
    // Telegram can be relied on again. This wins over a telegramEnabled sent in the same patch.
    const credsChanged =
      telegramClientId !== row.telegramClientId ||
      telegramOrigin !== row.telegramOrigin ||
      newSecret !== null;
    const telegram: TelegramFields = {
      telegramEnabled: credsChanged ? false : (dto.telegramEnabled ?? row.telegramEnabled),
      telegramClientId,
      telegramClientSecretEnc: newSecret
        ? this.crypto.encrypt(newSecret)
        : row.telegramClientSecretEnc,
      telegramOrigin,
      telegramUserId: credsChanged ? null : row.telegramUserId,
    };
    if (!credsChanged && dto.telegramEnabled === true && !this.telegramReady(telegram)) {
      throw new BadRequestException('Link your Telegram account first');
    }

    // Lockout guard: never leave the owner unable to sign in.
    this.assertSignInPossible({
      passwordEnabled,
      passkeyEnabled,
      passkeyCount: await this.passkeys.count(),
      telegramUsable: this.telegramUsable(telegram),
    });

    const data: Prisma.AuthConfigUpdateInput = {};
    if (dto.passwordEnabled !== undefined) data.passwordEnabled = dto.passwordEnabled;
    if (dto.passkeyEnabled !== undefined) data.passkeyEnabled = dto.passkeyEnabled;
    // Empty string clears the RP field (falls back to defaults / disables passkey ceremonies).
    if (dto.rpId !== undefined) data.rpId = dto.rpId.trim() || null;
    if (dto.rpName !== undefined) data.rpName = dto.rpName.trim() || null;
    if (dto.rpOrigin !== undefined) data.rpOrigin = dto.rpOrigin.trim() || null;
    if (dto.telegramClientId !== undefined) data.telegramClientId = telegramClientId;
    if (dto.telegramOrigin !== undefined) data.telegramOrigin = telegramOrigin;
    if (newSecret) data.telegramClientSecretEnc = telegram.telegramClientSecretEnc;
    if (dto.telegramEnabled !== undefined || credsChanged) {
      data.telegramEnabled = telegram.telegramEnabled;
    }
    if (credsChanged) {
      data.telegramUserId = null;
      data.telegramDisplayName = null;
    }

    await this.repo.update(data);
    return this.getConfig();
  }

  /**
   * The single lockout check: at least one sign-in method must keep working. Callers pass the
   * state as it would be after their change.
   */
  assertSignInPossible(methods: SignInMethods): void {
    if (methods.passwordEnabled) return;
    if (methods.passkeyEnabled && methods.passkeyCount > 0) return;
    if (methods.telegramUsable) return;
    throw new BadRequestException(
      'Keep at least one working sign-in method: password, a registered passkey or a linked Telegram account',
    );
  }

  /** Client ID, secret, origin and a linked account are all in place. */
  telegramReady(t: Omit<TelegramFields, 'telegramEnabled'>): boolean {
    return !!(
      t.telegramClientId &&
      t.telegramClientSecretEnc &&
      t.telegramOrigin &&
      t.telegramUserId
    );
  }

  /** Telegram sign-in is switched on and would actually work. */
  telegramUsable(t: TelegramFields): boolean {
    return t.telegramEnabled && this.telegramReady(t);
  }

  /** Decrypted client settings, or null when any of them is missing. */
  getTelegramClient(row: AuthConfigRow): TelegramClient | null {
    if (!row.telegramClientId || !row.telegramClientSecretEnc || !row.telegramOrigin) return null;
    let clientSecret: string;
    try {
      clientSecret = this.crypto.decrypt(row.telegramClientSecretEnc);
    } catch {
      // Unreadable after an ENCRYPTION_KEY change: same remedy as a missing secret, save it again.
      return null;
    }
    return { clientId: row.telegramClientId, clientSecret, origin: row.telegramOrigin };
  }

  /** Remember the owner's Telegram account (end of the link round-trip) and enable the method. */
  async linkTelegram(telegramUserId: string, displayName: string | null): Promise<void> {
    await this.repo.update({
      telegramUserId,
      telegramDisplayName: displayName,
      telegramEnabled: true,
    });
  }

  async unlinkTelegram(): Promise<void> {
    const row = await this.requireRow();
    this.assertSignInPossible({
      passwordEnabled: row.passwordEnabled,
      passkeyEnabled: row.passkeyEnabled,
      passkeyCount: await this.passkeys.count(),
      telegramUsable: false,
    });
    await this.repo.update({
      telegramUserId: null,
      telegramDisplayName: null,
      telegramEnabled: false,
    });
  }

  /**
   * Session-cookie signing secret: random, generated once, stored AES-GCM encrypted on the admin
   * row and cached. Survives restarts (unlike the old derive-from-creds scheme), no env var needed.
   */
  async getSessionSecret(): Promise<string> {
    if (this.cachedSecret) return this.cachedSecret;
    const row = await this.getRow();
    // Pre-setup: there are no real sessions yet. Hand out a throwaway secret (not cached).
    if (!row) return randomBytes(32).toString('hex');
    if (row.sessionSecretEnc) {
      this.cachedSecret = this.crypto.decrypt(row.sessionSecretEnc);
      return this.cachedSecret;
    }
    const secret = randomBytes(32).toString('hex');
    await this.repo.update({ sessionSecretEnc: this.crypto.encrypt(secret) });
    this.cachedSecret = secret;
    return secret;
  }
}
