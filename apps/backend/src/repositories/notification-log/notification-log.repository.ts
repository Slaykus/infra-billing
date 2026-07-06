import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class NotificationLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Throttling check: was an alert with this dedup key already sent since `since`? */
  async wasSentSince(dedupKey: string, since: Date): Promise<boolean> {
    const recent = await this.prisma.notificationLog.findFirst({
      where: { dedupKey, sentAt: { gte: since } },
    });
    return recent !== null;
  }

  async record(dedupKey: string): Promise<void> {
    await this.prisma.notificationLog.create({ data: { dedupKey } });
  }
}
