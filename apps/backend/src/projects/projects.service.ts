import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@generated/prisma/client';
import { BulkMoveResult, DEFAULT_PROJECT_UUID, Project as ProjectDto } from '@infra/shared';
import { PrismaService } from '../prisma/prisma.service';
import { mapProject } from '@common/mappers';
import { CreateProjectDto, UpdateProjectDto } from './dto/project.dto';

const COUNT_INCLUDE = { _count: { select: { services: true } } } as const;

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<ProjectDto[]> {
    const rows = await this.prisma.project.findMany({
      orderBy: { createdAt: 'asc' },
      include: COUNT_INCLUDE,
    });
    return rows.map(mapProject);
  }

  async create(dto: CreateProjectDto): Promise<ProjectDto> {
    const p = await this.prisma.project.create({
      data: { name: dto.name, faviconLink: dto.faviconLink || null },
      include: COUNT_INCLUDE,
    });
    return mapProject(p);
  }

  async update(uuid: string, dto: UpdateProjectDto): Promise<ProjectDto> {
    await this.ensureExists(uuid);
    const data: Prisma.ProjectUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.faviconLink !== undefined) data.faviconLink = dto.faviconLink || null;
    const p = await this.prisma.project.update({ where: { uuid }, data, include: COUNT_INCLUDE });
    return mapProject(p);
  }

  /** Move EVERY service (from any project) into this project. Returns the count actually moved. */
  async moveAllInto(uuid: string): Promise<BulkMoveResult> {
    await this.ensureExists(uuid);
    const { count } = await this.prisma.service.updateMany({
      where: { projectUuid: { not: uuid } },
      data: { projectUuid: uuid },
    });
    return { moved: count };
  }

  /** Empty this project: move its services to the default project (services are never deleted). */
  async empty(uuid: string): Promise<BulkMoveResult> {
    await this.ensureExists(uuid);
    if (uuid === DEFAULT_PROJECT_UUID) return { moved: 0 }; // already the sink, nothing to do
    const { count } = await this.prisma.service.updateMany({
      where: { projectUuid: uuid },
      data: { projectUuid: DEFAULT_PROJECT_UUID },
    });
    return { moved: count };
  }

  async remove(uuid: string): Promise<void> {
    if (uuid === DEFAULT_PROJECT_UUID) {
      throw new BadRequestException('The default project cannot be deleted');
    }
    await this.ensureExists(uuid);
    // onDelete is Restrict, so move this project's services to the default project before deleting.
    await this.prisma.$transaction([
      this.prisma.service.updateMany({
        where: { projectUuid: uuid },
        data: { projectUuid: DEFAULT_PROJECT_UUID },
      }),
      this.prisma.project.delete({ where: { uuid } }),
    ]);
  }

  private async ensureExists(uuid: string): Promise<void> {
    const found = await this.prisma.project.findUnique({ where: { uuid }, select: { uuid: true } });
    if (!found) throw new NotFoundException('Project not found');
  }
}
