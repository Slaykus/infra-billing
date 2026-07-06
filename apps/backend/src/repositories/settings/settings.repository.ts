import { Injectable } from '@nestjs/common';
import { Prisma } from '@generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

// The Settings table is a singleton row with id=1; all access goes through that key.
@Injectable()
export class SettingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  find() {
    return this.prisma.settings.findUnique({ where: { id: 1 } });
  }

  /** Read the singleton row, seeding it with the schema column defaults on first access. */
  ensure() {
    return this.prisma.settings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  }

  update(data: Prisma.SettingsUpdateInput) {
    return this.prisma.settings.update({ where: { id: 1 }, data });
  }
}
