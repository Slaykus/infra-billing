import { Injectable } from '@nestjs/common';
import { Prisma } from '@generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ApiTokensRepository {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.apiToken.findMany({ orderBy: { createdAt: 'desc' } });
  }

  findByHash(tokenHash: string) {
    return this.prisma.apiToken.findUnique({ where: { tokenHash } });
  }

  async exists(uuid: string): Promise<boolean> {
    const found = await this.prisma.apiToken.findUnique({
      where: { uuid },
      select: { uuid: true },
    });
    return found !== null;
  }

  create(data: Prisma.ApiTokenCreateInput) {
    return this.prisma.apiToken.create({ data });
  }

  /** Best-effort usage marker: a failed write must not fail the authenticated request. */
  async touchLastUsed(uuid: string, at: Date): Promise<void> {
    await this.prisma.apiToken
      .update({ where: { uuid }, data: { lastUsedAt: at } })
      .catch(() => undefined);
  }

  async delete(uuid: string): Promise<void> {
    await this.prisma.apiToken.delete({ where: { uuid } });
  }
}
