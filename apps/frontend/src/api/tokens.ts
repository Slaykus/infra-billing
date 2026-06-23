import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiToken, CreateApiToken } from '@infra/shared';
import { api } from './client';
import { API_PATH } from '@infra/shared';

export function useTokens() {
  return useQuery({
    queryKey: ['tokens'],
    queryFn: async () => (await api.get<ApiToken[]>(API_PATH.TOKENS.ROOT)).data,
  });
}

export function useCreateToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: CreateApiToken) =>
      (await api.post<ApiToken>(API_PATH.TOKENS.ROOT, dto)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tokens'] }),
  });
}

export function useDeleteToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (uuid: string) => {
      await api.delete(API_PATH.TOKENS.BY_ID(uuid));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tokens'] }),
  });
}
