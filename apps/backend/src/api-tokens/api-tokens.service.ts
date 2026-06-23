import { Injectable, NotFoundException } from '@nestjs/common';
import { ApiToken as ApiTokenDto } from '@infra/shared';
import { mapApiToken } from '@common/mappers';
import { PrismaService } from '../prisma/prisma.service';
import { CreateApiTokenDto } from './dto/api-token.dto';
import { generateToken } from './token.util';

@Injectable()
export class ApiTokensService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<ApiTokenDto[]> {
    const rows = await this.prisma.apiToken.findMany({ orderBy: { createdAt: 'desc' } });
    return rows.map(mapApiToken);
  }

  async create(dto: CreateApiTokenDto): Promise<ApiTokenDto> {
    const row = await this.prisma.apiToken.create({
      data: { tokenName: dto.tokenName, token: generateToken() },
    });
    return mapApiToken(row);
  }

  async remove(uuid: string): Promise<void> {
    const found = await this.prisma.apiToken.findUnique({
      where: { uuid },
      select: { uuid: true },
    });
    if (!found) throw new NotFoundException('API token not found');
    await this.prisma.apiToken.delete({ where: { uuid } });
  }
}
