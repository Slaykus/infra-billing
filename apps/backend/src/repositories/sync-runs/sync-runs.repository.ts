import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SyncRunsRepository {
  constructor(private readonly prisma: PrismaService) {}

  createRunning(providerUuid: string) {
    return this.prisma.syncRun.create({ data: { providerUuid, status: 'running' } });
  }

  markOk(id: bigint, servicesFound: number) {
    return this.prisma.syncRun.update({
      where: { id },
      data: { status: 'ok', servicesFound, finishedAt: new Date() },
    });
  }

  markError(id: bigint, error: string) {
    return this.prisma.syncRun.update({
      where: { id },
      data: { status: 'error', error, finishedAt: new Date() },
    });
  }

  listForProvider(providerUuid: string, limit: number) {
    return this.prisma.syncRun.findMany({
      where: { providerUuid },
      orderBy: { startedAt: 'desc' },
      take: limit,
    });
  }

  /** Failed runs finished since `since`, newest first, with the provider name/login link. */
  listErrorsSince(since: Date) {
    return this.prisma.syncRun.findMany({
      where: { status: 'error', finishedAt: { gte: since } },
      orderBy: { finishedAt: 'desc' },
      include: { provider: { select: { name: true, loginUrl: true } } },
    });
  }
}
