import { Injectable } from '@nestjs/common';
import { Prisma } from '@generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const COUNT_INCLUDE = { _count: { select: { services: true } } } as const;

@Injectable()
export class ProjectsRepository {
  constructor(private readonly prisma: PrismaService) {}

  listAll() {
    return this.prisma.project.findMany({ orderBy: { createdAt: 'asc' } });
  }

  listWithCounts() {
    return this.prisma.project.findMany({ orderBy: { createdAt: 'asc' }, include: COUNT_INCLUDE });
  }

  findByUuid(uuid: string) {
    return this.prisma.project.findUnique({ where: { uuid } });
  }

  async exists(uuid: string): Promise<boolean> {
    const found = await this.prisma.project.findUnique({
      where: { uuid },
      select: { uuid: true },
    });
    return found !== null;
  }

  create(data: Prisma.ProjectCreateInput) {
    return this.prisma.project.create({ data, include: COUNT_INCLUDE });
  }

  update(uuid: string, data: Prisma.ProjectUpdateInput) {
    return this.prisma.project.update({ where: { uuid }, data, include: COUNT_INCLUDE });
  }

  /** Delete a project, first moving its services to the fallback project (FK is Restrict). */
  async deleteMovingServices(uuid: string, fallbackProjectUuid: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.service.updateMany({
        where: { projectUuid: uuid },
        data: { projectUuid: fallbackProjectUuid },
      }),
      this.prisma.project.delete({ where: { uuid } }),
    ]);
  }
}
