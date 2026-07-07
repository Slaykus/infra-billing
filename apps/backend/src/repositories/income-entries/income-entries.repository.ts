import { Injectable } from '@nestjs/common';
import { IncomeEntry, Prisma } from '@generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface IncomeFilters {
  status?: string;
  source?: string;
  from?: Date;
  to?: Date;
}

/** Fields refreshed on every re-import of a receipt (status flips PENDING → SENT over time). */
interface ExternalIncomeData {
  amount: string;
  currency: string;
  description: string | null;
  incomeDate: Date;
  status: string;
  receiptLink: string | null;
}

@Injectable()
export class IncomeEntriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  listAll() {
    return this.prisma.incomeEntry.findMany();
  }

  listSince(from: Date) {
    return this.prisma.incomeEntry.findMany({ where: { incomeDate: { gte: from } } });
  }

  async listPaginated(
    filters: IncomeFilters,
    page: number,
    pageSize: number,
  ): Promise<{ rows: IncomeEntry[]; total: number }> {
    const where: Prisma.IncomeEntryWhereInput = {};
    if (filters.status) where.status = filters.status;
    if (filters.source) where.source = filters.source;
    if (filters.from || filters.to) {
      where.incomeDate = { gte: filters.from, lte: filters.to };
    }
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.incomeEntry.findMany({
        where,
        orderBy: { incomeDate: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.incomeEntry.count({ where }),
    ]);
    return { rows, total };
  }

  async exists(uuid: string): Promise<boolean> {
    const found = await this.prisma.incomeEntry.findUnique({
      where: { uuid },
      select: { uuid: true },
    });
    return found !== null;
  }

  create(data: Prisma.IncomeEntryUncheckedCreateInput) {
    return this.prisma.incomeEntry.create({ data });
  }

  /** Idempotent import upsert by (source, externalId); manual entries are never touched. */
  upsertExternal(source: string, externalId: string, data: ExternalIncomeData) {
    return this.prisma.incomeEntry.upsert({
      where: { source_externalId: { source, externalId } },
      create: { source, externalId, ...data },
      update: data,
    });
  }

  async delete(uuid: string): Promise<void> {
    await this.prisma.incomeEntry.delete({ where: { uuid } });
  }
}
