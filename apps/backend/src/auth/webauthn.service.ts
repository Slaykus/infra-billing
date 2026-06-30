import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  generateAuthenticationOptions,
  generateRegistrationOptions,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { Prisma } from '@generated/prisma/client';
import type { Passkey as PasskeyDto } from '@infra/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuthConfigService } from './auth-config.service';
import { ChallengeStore } from './challenge.store';
import { nextPasskeyName } from './passkey-name.util';

type AuthConfigRow = Prisma.AuthConfigGetPayload<Record<string, never>>;
type PasskeyRow = Prisma.PasskeyGetPayload<Record<string, never>>;

// Thin wrapper around @simplewebauthn/server. Persists passkeys and owns the passkey lockout guard.
@Injectable()
export class WebAuthnService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authConfig: AuthConfigService,
    private readonly challenges: ChallengeStore,
  ) {}

  // ---- registration (authenticated owner adding a key) ----

  async registerOptions(): Promise<PublicKeyCredentialCreationOptionsJSON> {
    const row = await this.authConfig.requireRow();
    const { rpId, rpName } = this.requireRp(row);
    const existing = await this.prisma.passkey.findMany();
    const options = await generateRegistrationOptions({
      rpName,
      rpID: rpId,
      userName: row.username,
      userID: row.webauthnUserId ?? undefined,
      attestationType: 'none',
      excludeCredentials: existing.map((p) => ({
        id: p.credentialId,
        transports: splitTransports(p.transports),
      })),
      authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
    });
    this.challenges.put('register', options.challenge);
    return options;
  }

  async verifyRegistration(response: RegistrationResponseJSON, name?: string): Promise<PasskeyDto> {
    const row = await this.authConfig.requireRow();
    const { rpId, origins } = this.requireRp(row);
    const challenge = this.challenges.take('register');
    if (!challenge) throw new BadRequestException('Registration challenge expired — start again');
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: origins,
      expectedRPID: rpId,
      requireUserVerification: false,
    });
    if (!verification.verified || !verification.registrationInfo) {
      throw new BadRequestException('Passkey registration could not be verified');
    }
    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
    // No explicit name → auto-name "Passkey", "Passkey 2", … (next free slot).
    let label = name?.trim();
    if (!label) {
      const existing = await this.prisma.passkey.findMany({ select: { name: true } });
      label = nextPasskeyName(existing.map((p) => p.name));
    }
    const created = await this.prisma.passkey.create({
      data: {
        credentialId: credential.id,
        publicKey: credential.publicKey,
        counter: BigInt(credential.counter),
        transports: credential.transports?.join(',') ?? null,
        deviceType: credentialDeviceType,
        backedUp: credentialBackedUp,
        name: label,
      },
    });
    return toPasskeyDto(created);
  }

  // ---- authentication (public, passwordless login) ----

  async loginOptions(): Promise<PublicKeyCredentialRequestOptionsJSON> {
    const row = await this.authConfig.requireRow();
    if (!row.passkeyEnabled) throw new UnauthorizedException('Passkey login is disabled');
    if ((await this.prisma.passkey.count()) === 0) {
      throw new UnauthorizedException('No passkeys registered');
    }
    const { rpId } = this.requireRp(row);
    const options = await generateAuthenticationOptions({
      rpID: rpId,
      userVerification: 'preferred',
      // Discoverable credentials: single user, let the platform pick the key (usernameless).
      allowCredentials: [],
    });
    this.challenges.put('login', options.challenge);
    return options;
  }

  async verifyLogin(response: AuthenticationResponseJSON): Promise<string> {
    const row = await this.authConfig.requireRow();
    if (!row.passkeyEnabled) throw new UnauthorizedException('Passkey login is disabled');
    const { rpId, origins } = this.requireRp(row);
    const challenge = this.challenges.take('login');
    if (!challenge) throw new BadRequestException('Login challenge expired — try again');
    const passkey = await this.prisma.passkey.findUnique({ where: { credentialId: response.id } });
    if (!passkey) throw new UnauthorizedException('Unknown passkey');
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: origins,
      expectedRPID: rpId,
      requireUserVerification: false,
      credential: {
        id: passkey.credentialId,
        publicKey: passkey.publicKey,
        counter: Number(passkey.counter),
        transports: splitTransports(passkey.transports),
      },
    });
    if (!verification.verified) throw new UnauthorizedException('Passkey verification failed');
    const newCounter = verification.authenticationInfo.newCounter;
    // Counter regression hints at a cloned authenticator. Platform passkeys commonly report 0, so
    // only reject when a real (non-zero) counter went backwards.
    if (newCounter !== 0 && newCounter <= Number(passkey.counter)) {
      throw new UnauthorizedException('Passkey counter regression');
    }
    await this.prisma.passkey.update({
      where: { uuid: passkey.uuid },
      data: { counter: BigInt(newCounter), lastUsedAt: new Date() },
    });
    return row.username;
  }

  // ---- management (authenticated) ----

  async list(): Promise<PasskeyDto[]> {
    const rows = await this.prisma.passkey.findMany({ orderBy: { createdAt: 'asc' } });
    return rows.map(toPasskeyDto);
  }

  async delete(uuid: string): Promise<void> {
    const row = await this.authConfig.requireRow();
    const passkey = await this.prisma.passkey.findUnique({ where: { uuid } });
    if (!passkey) throw new NotFoundException('Passkey not found');
    // Don't let the owner delete their only passkey when password login is off (lockout).
    if (!row.passwordEnabled && (await this.prisma.passkey.count()) <= 1) {
      throw new BadRequestException(
        'Cannot delete the last passkey while password login is disabled',
      );
    }
    await this.prisma.passkey.delete({ where: { uuid } });
  }

  /** Resolve the Relying Party config from the admin row, or fail with a clear hint. */
  private requireRp(row: AuthConfigRow): { rpId: string; rpName: string; origins: string[] } {
    if (!row.rpId || !row.rpOrigin) {
      throw new BadRequestException(
        'Configure passkey settings (Relying Party ID and Origin) before using passkeys',
      );
    }
    return {
      rpId: row.rpId,
      rpName: row.rpName || row.rpId,
      // rpOrigin may be a comma-separated list when the panel is reachable on several hostnames.
      origins: row.rpOrigin
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    };
  }
}

function splitTransports(csv: string | null): AuthenticatorTransportFuture[] | undefined {
  if (!csv) return undefined;
  return csv
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean) as AuthenticatorTransportFuture[];
}

function toPasskeyDto(row: PasskeyRow): PasskeyDto {
  return {
    uuid: row.uuid,
    name: row.name,
    deviceType: row.deviceType,
    backedUp: row.backedUp,
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt ? row.lastUsedAt.toISOString() : null,
  };
}
