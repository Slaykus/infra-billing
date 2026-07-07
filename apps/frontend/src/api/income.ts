import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateIncomeEntry,
  ForecastPoint,
  IncomeEntry,
  IncomeSummary,
  IncomeSyncResult,
  PaginatedIncome,
} from '@infra/shared';
import { API_PATH } from '@infra/shared';
import { api } from './client';

export interface IncomeFilter {
  status?: string;
  from?: string;
  to?: string;
}

interface UseIncomeOpts {
  page?: number;
  pageSize?: number;
}

export function useIncome(filter: IncomeFilter = {}, opts: UseIncomeOpts = {}) {
  const { page = 1, pageSize = 50 } = opts;
  return useQuery({
    queryKey: ['income', filter, page, pageSize],
    queryFn: async () => {
      const params: Record<string, string> = { page: String(page), pageSize: String(pageSize) };
      if (filter.status) params.status = filter.status;
      if (filter.from) params.from = filter.from;
      if (filter.to) params.to = filter.to;
      return (await api.get<PaginatedIncome>(API_PATH.INCOME.ROOT, { params })).data;
    },
  });
}

export function useIncomeSummary() {
  return useQuery({
    queryKey: ['income', 'summary'],
    queryFn: async () => (await api.get<IncomeSummary>(API_PATH.INCOME.SUMMARY)).data,
  });
}

export function useIncomeForecast(months = 12, monthsBack = 3) {
  return useQuery({
    queryKey: ['income', 'forecast', months, monthsBack],
    queryFn: async () =>
      (await api.get<ForecastPoint[]>(API_PATH.INCOME.FORECAST, { params: { months, monthsBack } }))
        .data,
  });
}

export function useCreateIncome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: CreateIncomeEntry) =>
      (await api.post<IncomeEntry>(API_PATH.INCOME.ROOT, dto)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['income'] }),
  });
}

export function useDeleteIncome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (uuid: string) => {
      await api.delete(API_PATH.INCOME.BY_ID(uuid));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['income'] }),
  });
}

export function useSyncIncome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => (await api.post<IncomeSyncResult>(API_PATH.INCOME.SYNC)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['income'] }),
  });
}
