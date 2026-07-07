import type { AnalyticsSummary } from '@infra/shared';
import { useTranslation } from 'react-i18next';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { useForecast } from '@/api/analytics';
import { useIncomeSummary } from '@/api/income';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { formatMoney, formatMoneyTick } from '@/utils/format';

interface ProfitCardProps {
  summary: AnalyticsSummary | undefined;
  base: string;
}

/** Revenue (from the income ledger) vs expenses (spend), with net profit. */
export function ProfitCard({ summary, base }: ProfitCardProps) {
  const { t } = useTranslation();
  const { data: income } = useIncomeSummary();
  // 12 months of actual monthly spend (months=0 future, monthsBack=11).
  const { data: spendForecast } = useForecast(0, 11);

  if (!income || !summary) return null;

  const revenueTotal = Number(income.totalRevenue);
  const spentTotal = Number(summary.totalSpent);
  if (revenueTotal === 0 && spentTotal === 0) return null;

  const profitTotal = revenueTotal - spentTotal;
  const monthProfit = Number(income.currentMonthRevenue) - Number(summary.currentMonthPayments);

  const spendByMonth = new Map((spendForecast ?? []).map((p) => [p.month, Number(p.actual)]));
  const data = income.monthly.map((m) => ({
    month: m.month,
    revenue: Number(m.confirmed),
    spend: spendByMonth.get(m.month) ?? 0,
  }));

  const config = {
    revenue: { label: t('dashboard.profit.revenueSeries'), color: 'var(--chart-1)' },
    spend: { label: t('dashboard.profit.expenseSeries'), color: 'var(--destructive)' },
  };
  const money = (v: number) => formatMoney(String(v), base);
  const sign = (v: number) => (v >= 0 ? 'text-success' : 'text-destructive');

  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle>{t('dashboard.profit.title', { base })}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">{t('dashboard.profit.revenue')}</p>
            <p className="font-mono text-lg font-bold text-success tabular-nums">
              {money(revenueTotal)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t('dashboard.profit.expenses')}</p>
            <p className="font-mono text-lg font-bold text-destructive tabular-nums">
              {money(spentTotal)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t('dashboard.profit.net')}</p>
            <p className={`font-mono text-lg font-bold tabular-nums ${sign(profitTotal)}`}>
              {money(profitTotal)}
            </p>
            <p className={`text-xs ${sign(monthProfit)}`}>
              {t('dashboard.profit.thisMonth')}: {money(monthProfit)}
            </p>
          </div>
        </div>
        <ChartContainer config={config} className="aspect-auto h-[200px] w-full">
          <BarChart data={data}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis width="auto" tickLine={false} axisLine={false} tickFormatter={formatMoneyTick} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name) => (
                    <div className="flex flex-1 items-center justify-between gap-2 leading-none">
                      <span className="text-muted-foreground">
                        {config[name as keyof typeof config]?.label ?? name}
                      </span>
                      <span className="font-mono font-medium text-foreground tabular-nums">
                        {money(Number(value))}
                      </span>
                    </div>
                  )}
                />
              }
            />
            <Bar dataKey="revenue" fill="var(--chart-1)" radius={2} />
            <Bar dataKey="spend" fill="var(--destructive)" radius={2} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
