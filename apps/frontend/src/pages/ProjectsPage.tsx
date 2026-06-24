import { useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Modal,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useDisclosure } from '@mantine/hooks';
import { useTranslation } from 'react-i18next';
import {
  IconEdit,
  IconFolderMinus,
  IconFolderPlus,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react';
import { DEFAULT_PROJECT_UUID, type Project } from '@infra/shared';
import {
  useCreateProject,
  useDeleteProject,
  useEmptyProject,
  useMoveAllToProject,
  useProjects,
  useUpdateProject,
} from '@/api/projects';
import { apiErrorMessage } from '@/api/client';
import { notifyError, notifySuccess } from '@/utils/notify';
import { projectFavicon } from '@/utils/favicon';
import { ProviderIcon } from '@/components/ProviderIcon';

export function ProjectsPage() {
  const { t } = useTranslation();
  const { data: projects, isLoading } = useProjects();
  const create = useCreateProject();
  const update = useUpdateProject();
  const del = useDeleteProject();
  const moveAll = useMoveAllToProject();
  const empty = useEmptyProject();
  const [opened, { open, close }] = useDisclosure(false);
  const [editing, setEditing] = useState<Project | null>(null);

  const form = useForm<{ name: string; faviconLink: string }>({
    initialValues: { name: '', faviconLink: '' },
    validate: { name: (v) => (v.trim() ? null : t('validation.enterName')) },
  });

  const openCreate = () => {
    setEditing(null);
    form.setValues({ name: '', faviconLink: '' });
    open();
  };

  const openEdit = (p: Project) => {
    setEditing(p);
    form.setValues({ name: p.name, faviconLink: p.faviconLink ?? '' });
    open();
  };

  const submit = form.onSubmit(async (v) => {
    const dto = { name: v.name.trim(), faviconLink: v.faviconLink.trim() || null };
    try {
      if (editing) {
        await update.mutateAsync({ uuid: editing.uuid, dto });
      } else {
        await create.mutateAsync({ name: dto.name, faviconLink: dto.faviconLink ?? undefined });
      }
      close();
      notifySuccess(editing ? t('projects.updated') : t('projects.created'));
    } catch (e) {
      notifyError(apiErrorMessage(e));
    }
  });

  const doDelete = async (p: Project) => {
    if (!window.confirm(t('projects.confirmDelete', { name: p.name }))) return;
    try {
      await del.mutateAsync(p.uuid);
      notifySuccess(t('common.deleted'));
    } catch (e) {
      notifyError(apiErrorMessage(e));
    }
  };

  const doMoveAll = async (p: Project) => {
    if (!window.confirm(t('projects.confirmMoveAll', { name: p.name }))) return;
    try {
      const { moved } = await moveAll.mutateAsync(p.uuid);
      notifySuccess(t('projects.movedToast', { count: moved }));
    } catch (e) {
      notifyError(apiErrorMessage(e));
    }
  };

  const doRemoveAll = async (p: Project) => {
    if (!window.confirm(t('projects.confirmRemoveAll', { name: p.name }))) return;
    try {
      const { moved } = await empty.mutateAsync(p.uuid);
      notifySuccess(t('projects.movedToast', { count: moved }));
    } catch (e) {
      notifyError(apiErrorMessage(e));
    }
  };

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <div>
          <Title order={2}>{t('projects.title')}</Title>
          <Text c="dimmed">{t('projects.subtitle')}</Text>
        </div>
        <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
          {t('common.add')}
        </Button>
      </Group>

      <Table.ScrollContainer minWidth={520}>
        <Table verticalSpacing="sm" highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('projects.colName')}</Table.Th>
              <Table.Th ta="end">{t('projects.colServices')}</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {projects?.map((p) => {
              const isDefault = p.uuid === DEFAULT_PROJECT_UUID;
              return (
                <Table.Tr key={p.uuid}>
                  <Table.Td>
                    <Group gap={8} wrap="nowrap">
                      <ProviderIcon name={p.name} src={projectFavicon(p.faviconLink)} size={20} />
                      <Text fw={600}>{p.name}</Text>
                      {isDefault && (
                        <Badge size="xs" variant="light" color="gray">
                          {t('projects.defaultBadge')}
                        </Badge>
                      )}
                    </Group>
                  </Table.Td>
                  <Table.Td ta="end">{p.servicesCount ?? 0}</Table.Td>
                  <Table.Td>
                    <Group gap={4} justify="flex-end" wrap="nowrap">
                      <Tooltip label={t('projects.actionMoveAll')}>
                        <ActionIcon
                          variant="subtle"
                          color="green"
                          loading={moveAll.isPending}
                          onClick={() => doMoveAll(p)}
                        >
                          <IconFolderPlus size={16} />
                        </ActionIcon>
                      </Tooltip>
                      {!isDefault && (
                        <Tooltip label={t('projects.actionRemoveAll')}>
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            loading={empty.isPending}
                            onClick={() => doRemoveAll(p)}
                          >
                            <IconFolderMinus size={16} />
                          </ActionIcon>
                        </Tooltip>
                      )}
                      <ActionIcon variant="subtle" onClick={() => openEdit(p)}>
                        <IconEdit size={16} />
                      </ActionIcon>
                      {!isDefault && (
                        <ActionIcon variant="subtle" color="red" onClick={() => doDelete(p)}>
                          <IconTrash size={16} />
                        </ActionIcon>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              );
            })}
            {!isLoading && projects?.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={3}>
                  <Text c="dimmed" ta="center" py="md">
                    {t('projects.empty')}
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      <Modal
        opened={opened}
        onClose={close}
        title={editing ? t('projects.modalEdit') : t('projects.modalCreate')}
      >
        <form onSubmit={submit}>
          <Stack>
            <TextInput
              label={t('projects.fieldName')}
              placeholder={t('projects.namePlaceholder')}
              required
              data-autofocus
              {...form.getInputProps('name')}
            />
            <TextInput
              label={t('projects.fieldFavicon')}
              description={t('projects.faviconHint')}
              placeholder={t('projects.faviconPlaceholder')}
              {...form.getInputProps('faviconLink')}
            />
            <Button type="submit" loading={create.isPending || update.isPending}>
              {t('common.save')}
            </Button>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}
