import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@generated/prisma/client';
import { Service as ServiceDto } from '@infra/shared';
import { PrismaService } from '../prisma/prisma.service';
import { mapService } from '@common/mappers';
import { CreateServiceDto, ServiceQueryDto, UpdateServiceDto } from './dto/service.dto';

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ServiceQueryDto): Promise<ServiceDto[]> {
    const where: Prisma.ServiceWhereInput = {};
    if (query.providerUuid) where.providerUuid = query.providerUuid;
    if (query.projectUuid) where.projectUuid = query.projectUuid;
    if (query.type) where.type = query.type;
    if (query.isActive !== undefined) where.isActive = query.isActive;
    const rows = await this.prisma.service.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      include: { _count: { select: { payments: true } } },
    });
    return rows.map(mapService);
  }

  async create(dto: CreateServiceDto): Promise<ServiceDto> {
    await this.ensureProvider(dto.providerUuid);
    await this.ensureProject(dto.projectUuid);
    const s = await this.prisma.service.create({
      data: {
        providerUuid: dto.providerUuid,
        projectUuid: dto.projectUuid,
        name: dto.name,
        type: dto.type,
        cost: dto.cost,
        currency: dto.currency,
        period: dto.period,
        countryCode: dto.countryCode ?? 'XX',
        nextBillingAt: dto.nextBillingAt ? new Date(dto.nextBillingAt) : null,
        isActive: dto.isActive ?? true,
        isManaged: false,
      },
    });
    return mapService(s);
  }

  async update(uuid: string, dto: UpdateServiceDto): Promise<ServiceDto> {
    const existing = await this.prisma.service.findUnique({
      where: { uuid },
      select: { uuid: true, isManaged: true, providerUuid: true },
    });
    if (!existing) throw new NotFoundException('Service not found');

    const data: Prisma.ServiceUpdateInput = {};
    if (dto.name !== undefined) {
      data.name = dto.name;
      // Manual name edit. Sync must not overwrite it.
      data.nameOverridden = true;
    }
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.cost !== undefined) {
      data.cost = dto.cost;
      // Manual price edit. Sync must not overwrite it.
      data.costOverridden = true;
    }
    if (dto.currency !== undefined) data.currency = dto.currency;
    if (dto.period !== undefined) data.period = dto.period;
    if (dto.countryCode !== undefined) data.countryCode = dto.countryCode;
    if (dto.nextBillingAt !== undefined) {
      data.nextBillingAt = dto.nextBillingAt ? new Date(dto.nextBillingAt) : null;
    }
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.projectUuid !== undefined) {
      await this.ensureProject(dto.projectUuid);
      data.project = { connect: { uuid: dto.projectUuid } };
    }

    // Provider can only change for manual services: a synced one is matched by
    // (providerUuid, externalId), so moving it would orphan it from sync.
    const moving = dto.providerUuid !== undefined && dto.providerUuid !== existing.providerUuid;
    if (!moving) {
      const s = await this.prisma.service.update({ where: { uuid }, data });
      return mapService(s);
    }
    if (existing.isManaged) {
      throw new ConflictException('Cannot change the provider of a synced service');
    }
    const newProviderUuid = dto.providerUuid as string;
    await this.ensureProvider(newProviderUuid);
    data.provider = { connect: { uuid: newProviderUuid } };
    // Re-link the service's payments to the new provider so they stay consistent.
    const s = await this.prisma.$transaction(async (tx) => {
      await tx.payment.updateMany({
        where: { serviceUuid: uuid },
        data: { providerUuid: newProviderUuid },
      });
      return tx.service.update({ where: { uuid }, data });
    });
    return mapService(s);
  }

  async remove(uuid: string): Promise<void> {
    await this.ensureExists(uuid);
    await this.prisma.service.delete({ where: { uuid } });
  }

  private async ensureExists(uuid: string): Promise<void> {
    const found = await this.prisma.service.findUnique({ where: { uuid }, select: { uuid: true } });
    if (!found) throw new NotFoundException('Service not found');
  }

  private async ensureProvider(uuid: string): Promise<void> {
    const found = await this.prisma.provider.findUnique({
      where: { uuid },
      select: { uuid: true },
    });
    if (!found) throw new NotFoundException('Provider not found');
  }

  private async ensureProject(uuid: string): Promise<void> {
    const found = await this.prisma.project.findUnique({ where: { uuid }, select: { uuid: true } });
    if (!found) throw new NotFoundException('Project not found');
  }
}
