import { Injectable } from '@nestjs/common';
import { Prisma } from '@generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class BalanceSnapshotsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async record(providerUuid: string, balance: string, currency: string): Promise<void> {
    await this.prisma.balanceSnapshot.create({ data: { providerUuid, balance, currency } });
  }

  /** All providers' snapshots captured since `from`, oldest first (runway burn-rate input). */
  listSince(from: Date) {
    return this.prisma.balanceSnapshot.findMany({
      where: { capturedAt: { gte: from } },
      orderBy: { capturedAt: 'asc' },
    });
  }

  listForProvider(providerUuid: string, from?: Date, to?: Date) {
    const where: Prisma.BalanceSnapshotWhereInput = { providerUuid };
    if (from || to) where.capturedAt = { gte: from, lte: to };
    return this.prisma.balanceSnapshot.findMany({ where, orderBy: { capturedAt: 'asc' } });
  }
}
