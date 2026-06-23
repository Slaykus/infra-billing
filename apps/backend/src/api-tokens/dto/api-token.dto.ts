import { createZodDto } from 'nestjs-zod';
import { apiTokenSchema, createApiTokenSchema } from '@infra/shared';

export class CreateApiTokenDto extends createZodDto(createApiTokenSchema) {}

export class ApiTokenDto extends createZodDto(apiTokenSchema) {}
