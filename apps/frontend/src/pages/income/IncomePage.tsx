import { IconPlus, IconRefresh } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { apiErrorMessage } from '@/api/client';
import {
  useCreateIncome,
  useDeleteIncome,
  useIncome,
  useIncomeForecast,
  useIncomeSummary,
  useSyncIncome,
} from '@/api/income';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { useDisclosure } from '@/hooks/useDisclosure';
import { formatMoney, formatMoneyTick, trimMoney } from '@/utils/format';
import { notifyError, notifySuccess } from '@/utils/notify';
import { type IForm, toIso } from './incomeForm';
import { IncomeFormModal } from './IncomeFormModal';
import { IncomeTable } from './IncomeTable';

const PAGE_SIZE = 50;

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card className="gap-1">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="font-mono text-2xl font-bold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

export function IncomePage() {
  const { t } = useTranslation();
  const { data, isLoading } = useIncome({}, { pageSize: PAGE_SIZE });
  const { data: summary } = useIncomeSummary();
  const { data: forecast } = useIncomeForecast();
  const create = useCreateIncome();
  const del = useDeleteIncome();
  const sync = useSyncIncome();
  const [opened, { open, close }] = useDisclosure(false);

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const base = summary?.baseCurrency ?? 'RUB';

  const form = useForm<IForm>({
    defaultValues: {
      amount: '',
      currency: 'RUB',
      incomeDate: dayjs().format('YYYY-MM-DD'),
      description: '',
    },
    mode: 'onSubmit',
  });

  const openCreate = () => {
    form.reset({
      amount: '',
      currency: 'RUB',
      incomeDate: dayjs().format('YYYY-MM-DD'),
      description: '',
    });
    open();
  };

  const submit = form.handleSubmit(async (v) => {
    try {
      await create.mutateAsync({
        amount: trimMoney(v.amount),
        currency: v.currency,
        incomeDate: toIso(v.incomeDate)!,
        description: v.description || undefined,
      });
      close();
      notifySuccess(t('income.created'));
    } catch (e) {
      notifyError(apiErrorMessage(e));
    }
  });

  const doDelete = async (uuid: string) => {
    if (!window.confirm(t('income.confirmDelete'))) return;
    try {
      await del.mutateAsync(uuid);
      notifySuccess(t('common.deleted'));
    } catch (e) {
      notifyError(apiErrorMessage(e));
    }
  };

  const doSync = async () => {
    try {
      const res = await sync.mutateAsync();
      if (res.ok) notifySuccess(t('income.synced', { count: res.fetched }));
      else notifyError(res.error ?? apiErrorMessage(null));
    } catch (e) {
      notifyError(apiErrorMessage(e));
    }
  };

  const monthly = (summary?.monthly ?? []).map((m) => ({
    month: m.month,
    confirmed: Number(m.confirmed),
    pending: Number(m.pending),
  }));
  const hasMonthly = monthly.some((m) => m.confirmed > 0 || m.pending > 0);
  const forecastData = (forecast ?? []).map((p) => ({
    month: p.month,
    actual: Number(p.actual),
    projected: Number(p.projected),
  }));
  const hasForecast = forecastData.some((p) => p.actual > 0 || p.projected > 0);

  const monthlyConfig = {
    confirmed: { label: t('income.confirmedSeries'), color: 'var(--chart-1)' },
    pending: { label: t('income.pendingSeries'), color: 'var(--chart-2)' },
  };
  const forecastConfig = {
    actual: { label: t('income.actualSeries'), color: 'var(--chart-1)' },
    projected: { label: t('income.projectedSeries'), color: 'var(--chart-1)' },
  };
  const chartMoney = (v: number) => formatMoney(String(v), base);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('income.title')}
        subtitle={t('income.subtitle')}
        actions={
          <>
            <Button variant="outline" onClick={doSync} disabled={sync.isPending}>
              <IconRefresh className={`size-4 ${sync.isPending ? 'animate-spin' : ''}`} />
              {t('income.sync')}
            </Button>
            <Button onClick={openCreate}>
              <IconPlus className="size-4" />
              {t('common.add')}
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi label={t('income.kpiTotal')} value={formatMoney(summary?.totalRevenue, base)} />
        <Kpi label={t('income.kpiPending')} value={formatMoney(summary?.pendingRevenue, base)} />
        <Kpi label={t('income.kpiMonth')} value={formatMoney(summary?.currentMonthRevenue, base)} />
      </div>

      {hasMonthly && (
        <Card className="gap-3">
          <CardHeader>
            <CardTitle>{t('income.monthlyTitle', { base })}</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={monthlyConfig} className="aspect-auto h-[220px] w-full">
              <BarChart data={monthly}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis width="auto" tickLine={false} axisLine={false} tickFormatter={formatMoneyTick} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name) => (
                        <div className="flex flex-1 items-center justify-between gap-2 leading-none">
                          <span className="text-muted-foreground">
                            {monthlyConfig[name as keyof typeof monthlyConfig]?.label ?? name}
                          </span>
                          <span className="font-mono font-medium text-foreground tabular-nums">
                            {chartMoney(Number(value))}
                          </span>
                        </div>
                      )}
                    />
                  }
                />
                <Bar dataKey="confirmed" stackId="rev" fill="var(--chart-1)" />
                <Bar dataKey="pending" stackId="rev" fill="var(--chart-2)" fillOpacity={0.6} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {hasForecast && (
        <Card className="gap-3">
          <CardHeader>
            <CardTitle>{t('income.forecastTitle', { base })}</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={forecastConfig} className="aspect-auto h-[200px] w-full">
              <BarChart data={forecastData}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis width="auto" tickLine={false} axisLine={false} tickFormatter={formatMoneyTick} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name) => (
                        <div className="flex flex-1 items-center justify-between gap-2 leading-none">
                          <span className="text-muted-foreground">
                            {forecastConfig[name as keyof typeof forecastConfig]?.label ?? name}
                          </span>
                          <span className="font-mono font-medium text-foreground tabular-nums">
                            {chartMoney(Number(value))}
                          </span>
                        </div>
                      )}
                    />
                  }
                />
                <Bar dataKey="actual" stackId="fc" fill="var(--chart-1)" />
                <Bar dataKey="projected" stackId="fc" fill="var(--chart-1)" fillOpacity={0.45} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      <IncomeTable items={items} isLoading={isLoading} total={total} onDelete={doDelete} />

      <IncomeFormModal
        opened={opened}
        form={form}
        isPending={create.isPending}
        onSubmit={submit}
        onClose={close}
      />
    </div>
  );
}
