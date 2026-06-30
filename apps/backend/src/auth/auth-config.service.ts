import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { Prisma } from '@generated/prisma/client';
import type { AuthConfig as AuthConfigDto, SetupStatus, UpdateAuthConfig } from '@infra/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../crypto/crypto.service';
import { hashPassword } from './password.util';

// The singleton AuthConfig row (id=1) at runtime. Bytes columns come back as Uint8Array.
type AuthConfigRow = Prisma.AuthConfigGetPayload<Record<string, never>>;

@Injectable()
export class AuthConfigService {
  // Session JWT secret, cached after first read so the guard doesn't hit the DB per request.
  private cachedSecret: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  /** The admin config row, or null when no admin has been set up yet. */
  getRow(): Promise<AuthConfigRow | null> {
    return this.prisma.authConfig.findUnique({ where: { id: 1 } });
  }

  async requireRow(): Promise<AuthConfigRow> {
    const row = await this.getRow();
    if (!row) throw new UnauthorizedException('Admin account is not configured');
    return row;
  }

  async needsSetup(): Promise<boolean> {
    return (await this.prisma.authConfig.count()) === 0;
  }

  /** Public bootstrap status driving the login/setup screen. */
  async getStatus(): Promise<SetupStatus> {
    const row = await this.getRow();
    if (!row) return { needsSetup: true, passwordEnabled: false, passkeyEnabled: false };
    return {
      needsSetup: false,
      passwordEnabled: row.passwordEnabled,
      passkeyEnabled: row.passkeyEnabled,
    };
  }

  /** Create the single admin account (first run). Fails if one already exists. */
  async setup(username: string, password: string): Promise<void> {
    if (!(await this.needsSetup())) {
      throw new ConflictException('Admin account is already configured');
    }
    const secret = randomBytes(32).toString('hex');
    await this.prisma.authConfig.create({
      data: {
        id: 1,
        username,
        passwordHash: hashPassword(password),
        passwordEnabled: true,
        passkeyEnabled: false,
        sessionSecretEnc: this.crypto.encrypt(secret),
        webauthnUserId: Uint8Array.from(randomBytes(32)),
      },
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
    };
  }

  async patchConfig(dto: UpdateAuthConfig): Promise<AuthConfigDto> {
    const row = await this.requireRow();
    const passwordEnabled = dto.passwordEnabled ?? row.passwordEnabled;
    const passkeyEnabled = dto.passkeyEnabled ?? row.passkeyEnabled;

    // Lockout guards: never leave the owner unable to sign in.
    if (!passwordEnabled && !passkeyEnabled) {
      throw new BadRequestException('At least one login method must remain enabled');
    }
    if (!passwordEnabled && (await this.prisma.passkey.count()) === 0) {
      throw new BadRequestException('Add a passkey before disabling password login');
    }

    const data: Prisma.AuthConfigUpdateInput = {};
    if (dto.passwordEnabled !== undefined) data.passwordEnabled = dto.passwordEnabled;
    if (dto.passkeyEnabled !== undefined) data.passkeyEnabled = dto.passkeyEnabled;
    // Empty string clears the RP field (falls back to defaults / disables passkey ceremonies).
    if (dto.rpId !== undefined) data.rpId = dto.rpId.trim() || null;
    if (dto.rpName !== undefined) data.rpName = dto.rpName.trim() || null;
    if (dto.rpOrigin !== undefined) data.rpOrigin = dto.rpOrigin.trim() || null;

    await this.prisma.authConfig.update({ where: { id: 1 }, data });
    return this.getConfig();
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
    await this.prisma.authConfig.update({
      where: { id: 1 },
      data: { sessionSecretEnc: this.crypto.encrypt(secret) },
    });
    this.cachedSecret = secret;
    return secret;
  }
}
