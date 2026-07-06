import { Injectable } from '@nestjs/common';
import { Prisma } from '@generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ExchangeRatesRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** All rates for a base, newest first — the first row per code is the effective rate. */
  listByBaseDesc(base: string) {
    return this.prisma.exchangeRate.findMany({
      where: { base },
      orderBy: { capturedAt: 'desc' },
    });
  }

  create(data: Prisma.ExchangeRateUncheckedCreateInput) {
    return this.prisma.exchangeRate.create({ data });
  }

  async createMany(rows: Prisma.ExchangeRateCreateManyInput[]): Promise<void> {
    await this.prisma.exchangeRate.createMany({ data: rows });
  }
}
