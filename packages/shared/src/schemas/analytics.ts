import { z } from 'zod';
import { currencySchema, isoDateSchema, moneySchema, uuidSchema } from './common';

export const byProviderSchema = z.object({
  providerUuid: uuidSchema,
  name: z.string(),
  monthlyCost: moneySchema,
  // Total paid out to this provider (top-ups + manual payments) in base currency.
  spent: moneySchema,
  balance: moneySchema.nullable(),
  balanceCurrency: currencySchema.nullable(),
  servicesCount: z.number().int(),
});

export const byCountrySchema = z.object({
  countryCode: z.string(),
  monthlyCost: moneySchema,
  servicesCount: z.number().int(),
});

export const byTypeSchema = z.object({
  type: z.string(),
  monthlyCost: moneySchema,
  servicesCount: z.number().int(),
});

export const byCurrencySchema = z.object({
  currency: currencySchema,
  monthlyCostOriginal: moneySchema,
  monthlyCostBase: moneySchema,
  servicesCount: z.number().int(),
});

/** critical = balance won't cover an imminent charge; warning = very soon / underfunded. */
export const billingSeveritySchema = z.enum(['critical', 'warning', 'ok']);
export type BillingSeverity = z.infer<typeof billingSeveritySchema>;

export const upcomingBillingSchema = z.object({
  serviceUuid: uuidSchema,
  name: z.string(),
  providerName: z.string(),
  nextBillingAt: isoDateSchema,
  cost: moneySchema,
  currency: currencySchema,
  costBase: moneySchema,
  daysUntil: z.number().int(),
  providerBalance: moneySchema.nullable(),
  providerBalanceCurrency: currencySchema.nullable(),
  // null = provider exposes no balance (e.g. Hetzner) → coverage unknown.
  covered: z.boolean().nullable(),
  severity: billingSeveritySchema,
});

export const analyticsSummarySchema = z.object({
  baseCurrency: currencySchema,
  monthlyTotal: moneySchema,
  yearlyProjection: moneySchema,
  currentMonthPayments: moneySchema,
  totalSpent: moneySchema,
  byProvider: z.array(byProviderSchema),
  byCountry: z.array(byCountrySchema),
  byType: z.array(byTypeSchema),
  byCurrency: z.array(byCurrencySchema),
  upcomingBillings: z.array(upcomingBillingSchema),
});
export type AnalyticsSummary = z.infer<typeof analyticsSummarySchema>;

export const forecastPointSchema = z.object({ month: z.string(), projected: moneySchema });
export type ForecastPoint = z.infer<typeof forecastPointSchema>;

export const balancePointSchema = z.object({
  balance: moneySchema,
  currency: currencySchema,
  capturedAt: isoDateSchema,
});
export type BalancePoint = z.infer<typeof balancePointSchema>;
