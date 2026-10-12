import { createZodDto } from 'nestjs-zod';
import {
  authConfigSchema,
  meSchema,
  passkeySchema,
  setupStatusSchema,
  telegramStartResponseSchema,
} from '@infra/shared';

export class MeDto extends createZodDto(meSchema) {}
export class AuthConfigDto extends createZodDto(authConfigSchema) {}
export class SetupStatusDto extends createZodDto(setupStatusSchema) {}
export class PasskeyDto extends createZodDto(passkeySchema) {}
export class TelegramStartDto extends createZodDto(telegramStartResponseSchema) {}
