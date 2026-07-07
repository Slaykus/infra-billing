import { createZodDto } from 'nestjs-zod';
import {
  createIncomeEntrySchema,
  incomeEntrySchema,
  incomeQuerySchema,
  incomeSummarySchema,
  incomeSyncResultSchema,
  paginatedIncomeSchema,
} from '@infra/shared';

export class CreateIncomeDto extends createZodDto(createIncomeEntrySchema) {}
export class IncomeEntryDto extends createZodDto(incomeEntrySchema) {}
export class PaginatedIncomeDto extends createZodDto(paginatedIncomeSchema) {}
export class IncomeSummaryDto extends createZodDto(incomeSummarySchema) {}
export class IncomeSyncResultDto extends createZodDto(incomeSyncResultSchema) {}
export class IncomeQueryDto extends createZodDto(incomeQuerySchema) {}
