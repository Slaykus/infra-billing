import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BulkMoveResult, CreateProject, Project, UpdateProject } from '@infra/shared';
import { api } from './client';
import { API_PATH } from '@infra/shared';

const KEY = ['projects'];

// Reassigning/renaming/deleting a project changes service grouping and the analytics breakdown.
const invalidateRelated = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: KEY });
  qc.invalidateQueries({ queryKey: ['services'] });
  qc.invalidateQueries({ queryKey: ['analytics'] });
};

export function useProjects() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => (await api.get<Project[]>(API_PATH.PROJECTS.ROOT)).data,
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: CreateProject) =>
      (await api.post<Project>(API_PATH.PROJECTS.ROOT, dto)).data,
    onSuccess: () => invalidateRelated(qc),
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ uuid, dto }: { uuid: string; dto: UpdateProject }) =>
      (await api.patch<Project>(API_PATH.PROJECTS.BY_ID(uuid), dto)).data,
    onSuccess: () => invalidateRelated(qc),
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (uuid: string) => {
      await api.delete(API_PATH.PROJECTS.BY_ID(uuid));
    },
    onSuccess: () => invalidateRelated(qc),
  });
}

// Move EVERY service into this project.
export function useMoveAllToProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (uuid: string) =>
      (await api.post<BulkMoveResult>(API_PATH.PROJECTS.MOVE_ALL(uuid))).data,
    onSuccess: () => invalidateRelated(qc),
  });
}

// Empty this project: move its services to the default project.
export function useEmptyProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (uuid: string) =>
      (await api.post<BulkMoveResult>(API_PATH.PROJECTS.EMPTY(uuid))).data,
    onSuccess: () => invalidateRelated(qc),
  });
}
