import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@generated/prisma/client';
import { Provider as ProviderDto, Service as ServiceDto } from '@infra/shared';
import { ProvidersRepository } from '@repositories/providers/providers.repository';
import { CryptoService } from '../crypto/crypto.service';
import { mapProvider, mapService } from '@common/mappers';
import { CreateProviderDto, UpdateProviderDto } from './dto/provider.dto';

@Injectable()
export class ProvidersService {
  constructor(
    private readonly providers: ProvidersRepository,
    private readonly crypto: CryptoService,
  ) {}

  async list(): Promise<ProviderDto[]> {
    const rows = await this.providers.listWithCounts();
    return rows.map((r) => this.withCredentialHints(mapProvider(r), r.kind, r.credentialsEnc));
  }

  async getWithServices(uuid: string): Promise<ProviderDto & { services: ServiceDto[] }> {
    const p = await this.providers.findWithServices(uuid);
    if (!p) throw new NotFoundException('Provider not found');
    const dto = this.withCredentialHints(mapProvider(p), p.kind, p.credentialsEnc);
    return { ...dto, services: p.services.map(mapService) };
  }

  /** Expose non-secret credential fields (baseUrl/username/accountId) for the edit form. */
  private withCredentialHints(dto: ProviderDto, kind: string, enc: Uint8Array | null): ProviderDto {
    if (kind === 'selectel') {
      const c = this.decodeCredentials(enc);
      // Never expose the password.
      return {
        ...dto,
        accountId: c.accountId ?? null,
        username: c.username ?? null,
        projectName: c.projectName ?? null,
      };
    }
    if (kind === '4vps') {
      // Never expose the token; panelId is a non-secret hint.
      const c = this.decodeCredentials(enc);
      return { ...dto, panelId: c.panelId ?? null };
    }
    if (kind === 'beget') {
      // Only the login is a non-secret hint; never expose password/totpSecret/apiPassword.
      const c = this.decodeCredentials(enc);
      return { ...dto, username: c.username ?? null };
    }
    if (kind === 'cloudflare') {
      // accountId is a non-secret hint; never expose the apiToken.
      const c = this.decodeCredentials(enc);
      return { ...dto, accountId: c.accountId ?? null };
    }
    if (kind !== 'hostbill' && kind !== 'billmgr') return dto;
    const c = this.decodeCredentials(enc);
    // Never expose password/totpSecret.
    return { ...dto, baseUrl: c.baseUrl ?? null, username: c.username ?? null };
  }

  async create(dto: CreateProviderDto): Promise<ProviderDto> {
    const p = await this.providers.create({
      name: dto.name,
      kind: dto.kind,
      loginUrl: dto.loginUrl ?? null,
      isPostpaid: dto.isPostpaid ?? false,
      credentialsEnc: this.buildCredentials(dto.kind, dto),
    });
    return this.withCredentialHints(mapProvider(p), p.kind, p.credentialsEnc);
  }

  async update(uuid: string, dto: UpdateProviderDto): Promise<ProviderDto> {
    const existing = await this.providers.findCredentials(uuid);
    if (!existing) throw new NotFoundException('Provider not found');
    const data: Prisma.ProviderUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.loginUrl !== undefined) data.loginUrl = dto.loginUrl;
    if (dto.isPostpaid !== undefined) data.isPostpaid = dto.isPostpaid;
    // Merge onto existing credentials so a partial edit works, e.g. adding only a TOTP
    // secret to an existing BILLmanager provider without re-entering the password.
    const creds = this.buildCredentials(existing.kind, dto, existing.credentialsEnc);
    if (creds !== null) data.credentialsEnc = creds;
    const p = await this.providers.update(uuid, data);
    return this.withCredentialHints(mapProvider(p), p.kind, p.credentialsEnc);
  }

  async remove(uuid: string): Promise<void> {
    await this.ensureExists(uuid);
    await this.providers.delete(uuid);
  }

  // Encrypt creds for storage: timeweb/hetzner → raw token; hostbill/billmgr/selectel/4vps → JSON.
  // Merged onto existingEnc so a partial edit (e.g. only a TOTP secret) keeps the rest. Returns null
  // when nothing credential-related was supplied (update leaves creds intact).
  private buildCredentials(
    kind: string,
    dto: {
      token?: string;
      baseUrl?: string;
      username?: string;
      password?: string;
      totpSecret?: string;
      accountId?: string;
      projectName?: string;
      panelId?: string;
      apiPassword?: string;
      secretKey?: string;
    },
    existingEnc?: Uint8Array | null,
  ): Uint8Array<ArrayBuffer> | null {
    if (kind === '4vps') {
      // JSON { token, panelId? }; merge so a panel-id-only edit keeps the token.
      if (!dto.token && !dto.panelId) return null;
      const base = this.decodeCredentials(existingEnc);
      const token = dto.token ?? base.token;
      if (!token) throw new BadRequestException('Provide the 4VPS API token');
      const creds: Record<string, string> = { token };
      const panelId = dto.panelId ?? base.panelId;
      if (panelId) creds.panelId = panelId;
      return this.crypto.encrypt(JSON.stringify(creds));
    }
    if (kind === 'selectel') {
      // Keystone service user: JSON { accountId, username, password, projectName? }; merge edits.
      const supplied = dto.accountId || dto.username || dto.password || dto.projectName;
      if (!supplied) return null;
      const base = this.decodeCredentials(existingEnc);
      const accountId = dto.accountId ?? base.accountId;
      const username = dto.username ?? base.username;
      const password = dto.password ?? base.password;
      if (!accountId || !username || !password) {
        throw new BadRequestException('Provide the account number, username and password together');
      }
      const creds: Record<string, string> = { accountId, username, password };
      const projectName = dto.projectName ?? base.projectName;
      if (projectName) creds.projectName = projectName;
      return this.crypto.encrypt(JSON.stringify(creds));
    }
    if (kind === 'hostbill' || kind === 'billmgr') {
      const supportsTotp = kind === 'billmgr';
      const supplied =
        dto.baseUrl || dto.username || dto.password || (supportsTotp && dto.totpSecret);
      if (!supplied) return null;

      const base = this.decodeCredentials(existingEnc);
      const baseUrl = dto.baseUrl ?? base.baseUrl;
      const username = dto.username ?? base.username;
      const password = dto.password ?? base.password;
      if (!baseUrl || !username || !password) {
        throw new BadRequestException('Provide baseUrl, username and password together');
      }
      const creds: Record<string, string> = { baseUrl, username, password };
      const totpSecret = supportsTotp ? (dto.totpSecret ?? base.totpSecret) : undefined;
      if (totpSecret) creds.totpSecret = totpSecret;
      return this.crypto.encrypt(JSON.stringify(creds));
    }
    if (kind === 'beget') {
      // JSON { username (login), password, totpSecret?, apiPassword? }; merge so a partial edit
      // (e.g. adding only the API password) keeps the rest.
      const supplied = dto.username || dto.password || dto.totpSecret || dto.apiPassword;
      if (!supplied) return null;
      const base = this.decodeCredentials(existingEnc);
      const username = dto.username ?? base.username;
      const password = dto.password ?? base.password;
      if (!username || !password) {
        throw new BadRequestException('Provide the Beget account login and password together');
      }
      const creds: Record<string, string> = { username, password };
      const totpSecret = dto.totpSecret ?? base.totpSecret;
      if (totpSecret) creds.totpSecret = totpSecret;
      const apiPassword = dto.apiPassword ?? base.apiPassword;
      if (apiPassword) creds.apiPassword = apiPassword;
      return this.crypto.encrypt(JSON.stringify(creds));
    }
    if (kind === 'cloudflare') {
      // JSON { accountId, apiToken }. `token` carries the API token. Merge so a partial edit works.
      if (!dto.accountId && !dto.token) return null;
      const base = this.decodeCredentials(existingEnc);
      const accountId = dto.accountId ?? base.accountId;
      const apiToken = dto.token ?? base.apiToken;
      if (!accountId || !apiToken) {
        throw new BadRequestException('Provide the Cloudflare account ID and API token together');
      }
      return this.crypto.encrypt(JSON.stringify({ accountId, apiToken }));
    }
    if (kind === 'porkbun') {
      // JSON { apiKey, secretApiKey }. `token` carries the API key. Merge so a partial edit works.
      if (!dto.token && !dto.secretKey) return null;
      const base = this.decodeCredentials(existingEnc);
      const apiKey = dto.token ?? base.apiKey;
      const secretApiKey = dto.secretKey ?? base.secretApiKey;
      if (!apiKey || !secretApiKey) {
        throw new BadRequestException('Provide both the Porkbun API key and secret key');
      }
      return this.crypto.encrypt(JSON.stringify({ apiKey, secretApiKey }));
    }
    if (kind !== 'manual' && dto.token) return this.crypto.encrypt(dto.token);
    return null;
  }

  /** Decrypt the stored JSON credentials (hostbill/billmgr), or {} if none/unparseable. */
  private decodeCredentials(enc?: Uint8Array | null): Record<string, string> {
    if (!enc) return {};
    try {
      return JSON.parse(this.crypto.decrypt(enc)) as Record<string, string>;
    } catch {
      return {};
    }
  }

  private async ensureExists(uuid: string): Promise<void> {
    if (!(await this.providers.exists(uuid))) throw new NotFoundException('Provider not found');
  }
}
