import { Injectable, NotFoundException } from '@nestjs/common';
import Decimal from 'decimal.js';
import dayjs from 'dayjs';
import {
  CreateIncomeEntry,
  ForecastPoint,
  IncomeEntry as IncomeEntryDto,
  IncomeSummary,
  PaginatedIncome,
} from '@infra/shared';
import { IncomeEntriesRepository } from '@repositories/income-entries/income-entries.repository';
import { CurrencyService } from '../currency/currency.service';
import { mapIncomeEntry } from '@common/mappers';
import { IncomeQueryDto } from './dto/income.dto';

const ZERO = () => new Decimal(0);

@Injectable()
export class IncomeService {
  constructor(
    private readonly repo: IncomeEntriesRepository,
    private readonly currency: CurrencyService,
  ) {}

  async list(query: IncomeQueryDto): Promise<PaginatedIncome> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const { rows, total } = await this.repo.listPaginated(query, page, pageSize);
    return { items: rows.map(mapIncomeEntry), total };
  }

  async create(dto: CreateIncomeEntry): Promise<IncomeEntryDto> {
    const e = await this.repo.create({
      source: 'manual',
      externalId: null,
      amount: dto.amount,
      currency: dto.currency,
      description: dto.description ?? null,
      incomeDate: new Date(dto.incomeDate),
      status: 'SENT',
      receiptLink: null,
    });
    return mapIncomeEntry(e);
  }

  async remove(uuid: string): Promise<void> {
    if (!(await this.repo.exists(uuid))) throw new NotFoundException('Income entry not found');
    await this.repo.delete(uuid);
  }

  async summary(): Promise<IncomeSummary> {
    const { baseCurrency } = await this.currency.getEffectiveSettings();
    const rates = await this.currency.getRubRates();
    const entries = await this.repo.listAll();

    const now = dayjs();
    const monthStart = now.startOf('month');
    const monthEnd = now.endOf('month');

    let totalRevenue = ZERO();
    let pendingRevenue = ZERO();
    let currentMonthRevenue = ZERO();
    const byStatus = new Map<string, { amount: Decimal; count: number }>();

    const windowStart = now.subtract(11, 'month').startOf('month');
    const monthly = new Map<string, { confirmed: Decimal; pending: Decimal }>();
    for (let i = 0; i < 12; i += 1) {
      monthly.set(windowStart.add(i, 'month').format('YYYY-MM'), {
        confirmed: ZERO(),
        pending: ZERO(),
      });
    }

    for (const e of entries) {
      const base = this.currency.convert(
        new Decimal(e.amount.toString()),
        e.currency,
        baseCurrency,
        rates,
      );
      const st = byStatus.get(e.status) ?? { amount: ZERO(), count: 0 };
      st.amount = st.amount.add(base);
      st.count += 1;
      byStatus.set(e.status, st);

      if (e.status === 'SENT') totalRevenue = totalRevenue.add(base);
      else if (e.status === 'PENDING') pendingRevenue = pendingRevenue.add(base);

      const d = dayjs(e.incomeDate);
      if (e.status === 'SENT' && !d.isBefore(monthStart) && !d.isAfter(monthEnd)) {
        currentMonthRevenue = currentMonthRevenue.add(base);
      }
      const m = monthly.get(d.format('YYYY-MM'));
      if (m) {
        if (e.status === 'SENT') m.confirmed = m.confirmed.add(base);
        else if (e.status === 'PENDING') m.pending = m.pending.add(base);
      }
    }

    return {
      baseCurrency,
      totalRevenue: totalRevenue.toFixed(2),
      pendingRevenue: pendingRevenue.toFixed(2),
      currentMonthRevenue: currentMonthRevenue.toFixed(2),
      entriesCount: entries.length,
      byStatus: [...byStatus].map(([status, v]) => ({
        status,
        amount: v.amount.toFixed(2),
        count: v.count,
      })),
      monthly: [...monthly].map(([month, v]) => ({
        month,
        confirmed: v.confirmed.toFixed(2),
        pending: v.pending.toFixed(2),
      })),
    };
  }

  /** Actual = confirmed monthly revenue; projected (future) = trailing avg of last 3 months. */
  async forecast(months: number, monthsBack: number): Promise<ForecastPoint[]> {
    const { baseCurrency } = await this.currency.getEffectiveSettings();
    const rates = await this.currency.getRubRates();

    const current = dayjs().startOf('month');
    const currentKey = current.format('YYYY-MM');
    const windowStart = current.subtract(monthsBack, 'month');
    const totalMonths = monthsBack + 1 + months;

    const monthsList: string[] = [];
    const actual = new Map<string, Decimal>();
    for (let i = 0; i < totalMonths; i += 1) {
      const key = windowStart.add(i, 'month').format('YYYY-MM');
      monthsList.push(key);
      actual.set(key, ZERO());
    }

    const entries = await this.repo.listSince(windowStart.toDate());
    for (const e of entries) {
      if (e.status !== 'SENT') continue;
      const key = dayjs(e.incomeDate).format('YYYY-MM');
      if (!actual.has(key) || key > currentKey) continue;
      actual.set(
        key,
        actual
          .get(key)!
          .add(
            this.currency.convert(new Decimal(e.amount.toString()), e.currency, baseCurrency, rates),
          ),
      );
    }

    const completed = monthsList.filter((m) => m < currentKey);
    const lastN = completed.slice(-3);
    let avg = ZERO();
    if (lastN.length) {
      let sum = ZERO();
      for (const m of lastN) sum = sum.add(actual.get(m)!);
      avg = sum.div(lastN.length);
    }

    return monthsList.map((m) => ({
      month: m,
      actual: (m <= currentKey ? actual.get(m)! : ZERO()).toFixed(2),
      projected: (m > currentKey ? avg : ZERO()).toFixed(2),
    }));
  }
}
