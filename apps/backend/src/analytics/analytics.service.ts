import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@generated/prisma/client';
import Decimal from 'decimal.js';
import dayjs from 'dayjs';
import { AnalyticsSummary, BalancePoint, ForecastPoint, Period, ProjectStats } from '@infra/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CurrencyService } from '../currency/currency.service';
import { monthlyCost } from '@common/money';

const ZERO = () => new Decimal(0);

interface Agg {
  monthly: Decimal;
  count: number;
}

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currency: CurrencyService,
  ) {}

  async summary(): Promise<AnalyticsSummary> {
    const { baseCurrency } = await this.currency.getEffectiveSettings();
    const rates = await this.currency.getRubRates();

    const [providers, projects, services, payments] = await Promise.all([
      this.prisma.provider.findMany({ orderBy: { createdAt: 'asc' } }),
      this.prisma.project.findMany({ orderBy: { createdAt: 'asc' } }),
      this.prisma.service.findMany({ where: { isActive: true } }),
      this.prisma.payment.findMany(),
    ]);
    const providerName = new Map(providers.map((p) => [p.uuid, p.name]));
    const providerByUuid = new Map(providers.map((p) => [p.uuid, p]));

    let monthlyTotal = ZERO();
    const byProvider = new Map<string, Agg>();
    const byProject = new Map<string, Agg>();
    const byCountry = new Map<string, Agg>();
    const byType = new Map<string, Agg>();
    const byCurrency = new Map<string, { original: Decimal; base: Decimal; count: number }>();

    for (const s of services) {
      const monthlyOrig = monthlyCost(new Decimal(s.cost.toString()), s.period as Period);
      const monthlyBase = this.currency.convert(monthlyOrig, s.currency, baseCurrency, rates);
      monthlyTotal = monthlyTotal.add(monthlyBase);
      bump(byProvider, s.providerUuid, monthlyBase);
      bump(byProject, s.projectUuid, monthlyBase);
      bump(byCountry, s.countryCode ?? 'XX', monthlyBase);
      bump(byType, s.type, monthlyBase);
      const c = byCurrency.get(s.currency) ?? { original: ZERO(), base: ZERO(), count: 0 };
      c.original = c.original.add(monthlyOrig);
      c.base = c.base.add(monthlyBase);
      c.count += 1;
      byCurrency.set(s.currency, c);
    }

    const now = dayjs();
    const monthStart = now.startOf('month');
    const monthEnd = now.endOf('month');
    let currentMonthPayments = ZERO();
    let totalSpent = ZERO();
    const spentByProvider = new Map<string, Decimal>();
    for (const p of payments) {
      // `charge` rows are per-service expense detail; counting them alongside top-ups would
      // double the spend, so the paid-out totals use top-ups + manual payments only.
      if (p.type === 'charge') continue;
      const base = this.currency.convert(
        new Decimal(p.amount.toString()),
        p.currency,
        baseCurrency,
        rates,
      );
      totalSpent = totalSpent.add(base);
      spentByProvider.set(
        p.providerUuid,
        (spentByProvider.get(p.providerUuid) ?? ZERO()).add(base),
      );
      const pd = dayjs(p.paymentDate);
      if (!pd.isBefore(monthStart) && !pd.isAfter(monthEnd)) {
        currentMonthPayments = currentMonthPayments.add(base);
      }
    }

    const horizon = now.add(14, 'day');
    const today = now.startOf('day');
    // Services billing within 14 days, sorted soonest-first.
    const upcomingSorted = services
      .filter(
        (s) =>
          s.nextBillingAt &&
          dayjs(s.nextBillingAt).isAfter(now) &&
          dayjs(s.nextBillingAt).isBefore(horizon),
      )
      .map((s) => ({
        s,
        date: dayjs(s.nextBillingAt!),
        costBase: this.currency.convert(
          new Decimal(s.cost.toString()),
          s.currency,
          baseCurrency,
          rates,
        ),
      }))
      .sort((a, b) => a.date.valueOf() - b.date.valueOf());

    // Running balance per provider (base currency); charges deplete it in date order, so once a
    // provider's funds run out the later charges in the window are flagged uncovered.
    const runningBalance = new Map<string, Decimal | null>();
    for (const p of providers) {
      runningBalance.set(
        p.uuid,
        p.balance != null && p.balanceCurrency
          ? this.currency.convert(
              new Decimal(p.balance.toString()),
              p.balanceCurrency,
              baseCurrency,
              rates,
            )
          : null,
      );
    }

    const upcomingBillings = upcomingSorted.map(({ s, date, costBase }) => {
      const bal = runningBalance.get(s.providerUuid) ?? null;
      let covered: boolean | null;
      if (bal == null) {
        covered = null; // provider has no balance API → unknown
      } else {
        covered = bal.gte(costBase);
        runningBalance.set(s.providerUuid, bal.sub(costBase));
      }
      const daysUntil = Math.max(0, date.startOf('day').diff(today, 'day'));
      let severity: 'critical' | 'warning' | 'ok';
      if (covered === false && daysUntil <= 7) severity = 'critical';
      else if (covered === false || daysUntil <= 3) severity = 'warning';
      else severity = 'ok';
      const provider = providerByUuid.get(s.providerUuid);
      return {
        serviceUuid: s.uuid,
        name: s.name,
        providerName: providerName.get(s.providerUuid) ?? '',
        providerLoginUrl: provider?.loginUrl ?? null,
        nextBillingAt: s.nextBillingAt!.toISOString(),
        cost: new Decimal(s.cost.toString()).toFixed(2),
        currency: s.currency,
        costBase: costBase.toFixed(2),
        daysUntil,
        providerBalance: provider?.balance != null ? provider.balance.toFixed(2) : null,
        providerBalanceCurrency: provider?.balanceCurrency ?? null,
        covered,
        severity,
      };
    });

    return {
      baseCurrency,
      monthlyTotal: monthlyTotal.toFixed(2),
      yearlyProjection: monthlyTotal.mul(12).toFixed(2),
      currentMonthPayments: currentMonthPayments.toFixed(2),
      totalSpent: totalSpent.toFixed(2),
      byProvider: providers.map((p) => ({
        providerUuid: p.uuid,
        name: p.name,
        monthlyCost: (byProvider.get(p.uuid)?.monthly ?? ZERO()).toFixed(2),
        spent: (spentByProvider.get(p.uuid) ?? ZERO()).toFixed(2),
        balance: p.balance ? p.balance.toFixed(2) : null,
        balanceCurrency: p.balanceCurrency,
        servicesCount: byProvider.get(p.uuid)?.count ?? 0,
      })),
      byProject: projects.map((p) => ({
        projectUuid: p.uuid,
        name: p.name,
        monthlyCost: (byProject.get(p.uuid)?.monthly ?? ZERO()).toFixed(2),
        servicesCount: byProject.get(p.uuid)?.count ?? 0,
      })),
      byCountry: [...byCountry].map(([countryCode, v]) => ({
        countryCode,
        monthlyCost: v.monthly.toFixed(2),
        servicesCount: v.count,
      })),
      byType: [...byType].map(([type, v]) => ({
        type,
        monthlyCost: v.monthly.toFixed(2),
        servicesCount: v.count,
      })),
      byCurrency: [...byCurrency].map(([currency, v]) => ({
        currency,
        monthlyCostOriginal: v.original.toFixed(2),
        monthlyCostBase: v.base.toFixed(2),
        servicesCount: v.count,
      })),
      upcomingBillings,
    };
  }

  /** Cost statistics for a single project (active services only), in the base currency. */
  async projectStats(projectUuid: string): Promise<ProjectStats> {
    const project = await this.prisma.project.findUnique({ where: { uuid: projectUuid } });
    if (!project) throw new NotFoundException('Project not found');

    const { baseCurrency } = await this.currency.getEffectiveSettings();
    const rates = await this.currency.getRubRates();
    const [providers, services] = await Promise.all([
      this.prisma.provider.findMany(),
      this.prisma.service.findMany({ where: { isActive: true, projectUuid } }),
    ]);
    const providerName = new Map(providers.map((p) => [p.uuid, p.name]));

    let monthlyTotal = ZERO();
    const byProvider = new Map<string, Agg>();
    const byCountry = new Map<string, Agg>();
    const byType = new Map<string, Agg>();
    for (const s of services) {
      const monthlyBase = this.currency.convert(
        monthlyCost(new Decimal(s.cost.toString()), s.period as Period),
        s.currency,
        baseCurrency,
        rates,
      );
      monthlyTotal = monthlyTotal.add(monthlyBase);
      bump(byProvider, s.providerUuid, monthlyBase);
      bump(byCountry, s.countryCode ?? 'XX', monthlyBase);
      bump(byType, s.type, monthlyBase);
    }

    return {
      projectUuid: project.uuid,
      name: project.name,
      baseCurrency,
      monthlyTotal: monthlyTotal.toFixed(2),
      yearlyProjection: monthlyTotal.mul(12).toFixed(2),
      servicesCount: services.length,
      byType: [...byType].map(([type, v]) => ({
        type,
        monthlyCost: v.monthly.toFixed(2),
        servicesCount: v.count,
      })),
      byCountry: [...byCountry].map(([countryCode, v]) => ({
        countryCode,
        monthlyCost: v.monthly.toFixed(2),
        servicesCount: v.count,
      })),
      byProvider: [...byProvider].map(([providerUuid, v]) => ({
        providerUuid,
        name: providerName.get(providerUuid) ?? '',
        monthlyCost: v.monthly.toFixed(2),
        servicesCount: v.count,
      })),
    };
  }

  async forecast(months: number, monthsBack: number): Promise<ForecastPoint[]> {
    const { baseCurrency } = await this.currency.getEffectiveSettings();
    const rates = await this.currency.getRubRates();

    const current = dayjs().startOf('month');
    const currentKey = current.format('YYYY-MM');
    const windowStart = current.subtract(monthsBack, 'month');
    const totalMonths = monthsBack + 1 + months; // past + current + future

    const monthsList: string[] = [];
    const actualBuckets = new Map<string, Decimal>();
    const projBuckets = new Map<string, Decimal>();
    for (let i = 0; i < totalMonths; i += 1) {
      const key = windowStart.add(i, 'month').format('YYYY-MM');
      monthsList.push(key);
      actualBuckets.set(key, ZERO());
      projBuckets.set(key, ZERO());
    }

    // Actuals: real charges (Selectel consumption, BILLmanager expenses, …) summed per month for
    // past + current months. These rows are excluded from KPI totals (§ summary), so no double count.
    const charges = await this.prisma.payment.findMany({
      where: { type: 'charge', paymentDate: { gte: windowStart.toDate() } },
    });
    for (const p of charges) {
      const key = dayjs(p.paymentDate).format('YYYY-MM');
      if (!actualBuckets.has(key) || key > currentKey) continue; // future-dated charges ignored
      const base = this.currency.convert(
        new Decimal(p.amount.toString()),
        p.currency,
        baseCurrency,
        rates,
      );
      actualBuckets.set(key, actualBuckets.get(key)!.add(base));
    }

    // Projection: recurring services billed strictly in the future (current month shows actuals only).
    const services = await this.prisma.service.findMany({
      where: { isActive: true, nextBillingAt: { not: null } },
    });
    const projStart = current.add(1, 'month');
    const projEnd = current.add(months + 1, 'month');
    for (const s of services) {
      const charge = this.currency.convert(
        new Decimal(s.cost.toString()),
        s.currency,
        baseCurrency,
        rates,
      );
      const step = periodStep(s.period);
      let d = dayjs(s.nextBillingAt!);
      if (!step) {
        const key = d.format('YYYY-MM');
        if (projBuckets.has(key) && !d.isBefore(projStart)) {
          projBuckets.set(key, projBuckets.get(key)!.add(charge));
        }
        continue;
      }
      let guard = 0;
      while (d.isBefore(projStart) && guard < 5000) {
        d = d.add(step.n, step.u);
        guard += 1;
      }
      guard = 0;
      while (d.isBefore(projEnd) && guard < 5000) {
        const key = d.format('YYYY-MM');
        if (projBuckets.has(key)) projBuckets.set(key, projBuckets.get(key)!.add(charge));
        d = d.add(step.n, step.u);
        guard += 1;
      }
    }

    return monthsList.map((m) => ({
      month: m,
      actual: actualBuckets.get(m)!.toFixed(2),
      projected: projBuckets.get(m)!.toFixed(2),
    }));
  }

  async balanceHistory(uuid: string, from?: Date, to?: Date): Promise<BalancePoint[]> {
    const where: Prisma.BalanceSnapshotWhereInput = { providerUuid: uuid };
    if (from || to) where.capturedAt = { gte: from, lte: to };
    const rows = await this.prisma.balanceSnapshot.findMany({
      where,
      orderBy: { capturedAt: 'asc' },
    });
    return rows.map((r) => ({
      balance: r.balance.toFixed(2),
      currency: r.currency,
      capturedAt: r.capturedAt.toISOString(),
    }));
  }
}

function bump(map: Map<string, Agg>, key: string, amount: Decimal): void {
  const cur = map.get(key) ?? { monthly: new Decimal(0), count: 0 };
  cur.monthly = cur.monthly.add(amount);
  cur.count += 1;
  map.set(key, cur);
}

function periodStep(period: string): { n: number; u: dayjs.ManipulateType } | null {
  switch (period) {
    case 'monthly':
    case 'hourly':
      return { n: 1, u: 'month' };
    case 'quarterly':
      return { n: 3, u: 'month' };
    case 'daily':
      return { n: 1, u: 'day' };
    case 'yearly':
      return { n: 1, u: 'year' };
    case 'onetime':
      return null;
    default:
      return { n: 1, u: 'month' };
  }
}
