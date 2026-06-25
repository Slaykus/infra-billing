import { z } from 'zod';
import { currencySchema, isoDateSchema, moneySchema, uuidSchema } from './common';

export const byProviderSchema = z.object({
  providerUuid: uuidSchema.describe('Provider UUID'),
  name: z.string().describe('Provider name'),
  monthlyCost: moneySchema.describe('Monthly cost in base currency'),
  // Total paid out to this provider (top-ups + manual payments) in base currency.
  spent: moneySchema.describe('Total spent in base currency'),
  balance: moneySchema.describe('Account balance').nullable(),
  balanceCurrency: currencySchema.describe('Balance currency').nullable(),
  servicesCount: z.number().int().describe('Number of services'),
});

export const byCountrySchema = z.object({
  countryCode: z.string().describe('ISO country code'),
  monthlyCost: moneySchema.describe('Monthly cost in base currency'),
  servicesCount: z.number().int().describe('Number of services'),
});

export const byTypeSchema = z.object({
  type: z.string().describe('Service type'),
  monthlyCost: moneySchema.describe('Monthly cost in base currency'),
  servicesCount: z.number().int().describe('Number of services'),
});

export const byProjectSchema = z.object({
  projectUuid: uuidSchema.describe('Project UUID'),
  name: z.string().describe('Project name'),
  monthlyCost: moneySchema.describe('Monthly cost in base currency'),
  servicesCount: z.number().int().describe('Number of services'),
});

/** A provider's contribution within a single project (no balance/spend — those are account-level). */
export const projectProviderStatSchema = z.object({
  providerUuid: uuidSchema.describe('Provider UUID'),
  name: z.string().describe('Provider name'),
  monthlyCost: moneySchema.describe('Monthly cost in base currency'),
  servicesCount: z.number().int().describe('Number of services'),
});

/** Cost statistics for a single project (active services only), in the base currency. */
export const projectStatsSchema = z.object({
  projectUuid: uuidSchema.describe('Project UUID'),
  name: z.string().describe('Project name'),
  baseCurrency: currencySchema.describe('Base currency code'),
  monthlyTotal: moneySchema.describe('Total monthly cost'),
  yearlyProjection: moneySchema.describe('Projected yearly cost'),
  servicesCount: z.number().int().describe('Number of active services'),
  byType: z.array(byTypeSchema).describe('Breakdown by service type'),
  byCountry: z.array(byCountrySchema).describe('Breakdown by country'),
  byProvider: z.array(projectProviderStatSchema).describe('Breakdown by provider'),
});
export type ProjectStats = z.infer<typeof projectStatsSchema>;

export const byCurrencySchema = z.object({
  currency: currencySchema.describe('Currency code'),
  monthlyCostOriginal: moneySchema.describe('Monthly cost in original currency'),
  monthlyCostBase: moneySchema.describe('Monthly cost in base currency'),
  servicesCount: z.number().int().describe('Number of services'),
});

/** critical = balance won't cover an imminent charge; warning = very soon / underfunded. */
export const billingSeveritySchema = z.enum(['critical', 'warning', 'ok']);
export type BillingSeverity = z.infer<typeof billingSeveritySchema>;

export const upcomingBillingSchema = z.object({
  serviceUuid: uuidSchema.describe('Service UUID'),
  name: z.string().describe('Service name'),
  providerName: z.string().describe('Provider name'),
  // Provider cabinet link (loginUrl) — used to deeplink the provider in Telegram alerts.
  providerLoginUrl: z.string().describe('Provider cabinet link').nullable(),
  nextBillingAt: isoDateSchema.describe('Next billing date'),
  cost: moneySchema.describe('Cost in service currency'),
  currency: currencySchema.describe('Service currency'),
  costBase: moneySchema.describe('Cost in base currency'),
  daysUntil: z.number().int().describe('Days until billing'),
  providerBalance: moneySchema.describe('Provider balance').nullable(),
  providerBalanceCurrency: currencySchema.describe('Provider balance currency').nullable(),
  // null = provider exposes no balance (e.g. Hetzner) → coverage unknown.
  covered: z.boolean().describe('Balance covers charge').nullable(),
  severity: billingSeveritySchema.describe('Billing severity level'),
});

export const analyticsSummarySchema = z.object({
  baseCurrency: currencySchema.describe('Base currency code'),
  monthlyTotal: moneySchema.describe('Total monthly cost'),
  yearlyProjection: moneySchema.describe('Projected yearly cost'),
  currentMonthPayments: moneySchema.describe('Payments this month'),
  totalSpent: moneySchema.describe('Total spent overall'),
  byProvider: z.array(byProviderSchema).describe('Breakdown by provider'),
  byProject: z.array(byProjectSchema).describe('Breakdown by project'),
  byCountry: z.array(byCountrySchema).describe('Breakdown by country'),
  byType: z.array(byTypeSchema).describe('Breakdown by service type'),
  byCurrency: z.array(byCurrencySchema).describe('Breakdown by currency'),
  upcomingBillings: z.array(upcomingBillingSchema).describe('Upcoming billings'),
});
export type AnalyticsSummary = z.infer<typeof analyticsSummarySchema>;

export const forecastPointSchema = z.object({
  month: z.string().describe('Month'),
  projected: moneySchema.describe('Projected cost (future months)'),
  actual: moneySchema.describe('Actual charges (past/current months)'),
});
export type ForecastPoint = z.infer<typeof forecastPointSchema>;

export const balancePointSchema = z.object({
  balance: moneySchema.describe('Balance amount'),
  currency: currencySchema.describe('Balance currency'),
  capturedAt: isoDateSchema.describe('Snapshot timestamp'),
});
export type BalancePoint = z.infer<typeof balancePointSchema>;
