import { z } from 'zod';
import { currencySchema, isoDateSchema, uuidSchema } from './common';

/** One income record: a receipt synced from the receipts service, or a manual entry. */
export const incomeEntrySchema = z.object({
  uuid: uuidSchema,
  source: z.string().describe('Income source: "moy-nalog" | "manual"'),
  externalId: z.string().describe('Receipt payment_id; null for manual').nullable(),
  amount: z.string().describe('Amount in the entry currency'),
  currency: currencySchema,
  description: z.string().describe('What the income was for').nullable(),
  incomeDate: isoDateSchema.describe('When the income occurred'),
  status: z.string().describe('SENT | PENDING | DEAD'),
  receiptLink: z.string().describe('Link to the fiscal receipt').nullable(),
  createdAt: isoDateSchema,
});
export type IncomeEntry = z.infer<typeof incomeEntrySchema>;

export const paginatedIncomeSchema = z.object({
  items: z.array(incomeEntrySchema),
  total: z.number().int(),
});
export type PaginatedIncome = z.infer<typeof paginatedIncomeSchema>;

/** Manual income entry (source is forced to "manual" server-side). */
export const createIncomeEntrySchema = z.object({
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Amount must be a positive number'),
  currency: currencySchema,
  description: z.string().max(500).optional(),
  incomeDate: z.string().describe('ISO date'),
});
export type CreateIncomeEntry = z.infer<typeof createIncomeEntrySchema>;

export const incomeQuerySchema = z.object({
  status: z.enum(['SENT', 'PENDING', 'DEAD']).optional(),
  source: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});
export type IncomeQuery = z.infer<typeof incomeQuerySchema>;

/** Result of a manual income sync trigger. */
export const incomeSyncResultSchema = z.object({
  fetched: z.number().int(),
  upserted: z.number().int(),
  ok: z.boolean(),
  error: z.string().nullable(),
});
export type IncomeSyncResult = z.infer<typeof incomeSyncResultSchema>;

/** Revenue rolled up per month, in the base currency. */
export const incomeMonthlyPointSchema = z.object({
  month: z.string().describe('YYYY-MM'),
  confirmed: z.string().describe('SENT revenue in base currency'),
  pending: z.string().describe('PENDING revenue in base currency'),
});
export type IncomeMonthlyPoint = z.infer<typeof incomeMonthlyPointSchema>;

export const incomeByStatusSchema = z.object({
  status: z.string(),
  amount: z.string().describe('Revenue in base currency'),
  count: z.number().int(),
});
export type IncomeByStatus = z.infer<typeof incomeByStatusSchema>;

/** Revenue analytics (mirrors the spend summary, from the income ledger). */
export const incomeSummarySchema = z.object({
  baseCurrency: currencySchema,
  totalRevenue: z.string().describe('All-time confirmed (SENT) revenue in base currency'),
  pendingRevenue: z.string().describe('All-time PENDING revenue in base currency'),
  currentMonthRevenue: z.string().describe('Confirmed revenue in the current month'),
  entriesCount: z.number().int(),
  byStatus: z.array(incomeByStatusSchema),
  monthly: z.array(incomeMonthlyPointSchema),
});
export type IncomeSummary = z.infer<typeof incomeSummarySchema>;
