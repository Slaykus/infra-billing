import { Injectable } from '@nestjs/common';
import { Prisma } from '@generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

// The AuthConfig table is a singleton row with id=1; all access goes through that key.
@Injectable()
export class AuthConfigRepository {
  constructor(private readonly prisma: PrismaService) {}

  find() {
    return this.prisma.authConfig.findUnique({ where: { id: 1 } });
  }

  count() {
    return this.prisma.authConfig.count();
  }

  create(data: Prisma.AuthConfigCreateInput) {
    return this.prisma.authConfig.create({ data: { ...data, id: 1 } });
  }

  update(data: Prisma.AuthConfigUpdateInput) {
    return this.prisma.authConfig.update({ where: { id: 1 }, data });
  }
}
