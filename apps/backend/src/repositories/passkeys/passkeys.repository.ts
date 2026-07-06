import { Injectable } from '@nestjs/common';
import { Prisma } from '@generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PasskeysRepository {
  constructor(private readonly prisma: PrismaService) {}

  listAll() {
    return this.prisma.passkey.findMany({ orderBy: { createdAt: 'asc' } });
  }

  async listNames(): Promise<(string | null)[]> {
    const rows = await this.prisma.passkey.findMany({ select: { name: true } });
    return rows.map((r) => r.name);
  }

  count() {
    return this.prisma.passkey.count();
  }

  findByUuid(uuid: string) {
    return this.prisma.passkey.findUnique({ where: { uuid } });
  }

  findByCredentialId(credentialId: string) {
    return this.prisma.passkey.findUnique({ where: { credentialId } });
  }

  create(data: Prisma.PasskeyCreateInput) {
    return this.prisma.passkey.create({ data });
  }

  /** Persist the authenticator counter after a successful login. */
  async recordLogin(uuid: string, counter: bigint): Promise<void> {
    await this.prisma.passkey.update({
      where: { uuid },
      data: { counter, lastUsedAt: new Date() },
    });
  }

  async delete(uuid: string): Promise<void> {
    await this.prisma.passkey.delete({ where: { uuid } });
  }
}
