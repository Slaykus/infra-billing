import {
  ActionIcon,
  Button,
  Code,
  CopyButton,
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
import { IconCheck, IconCopy, IconPlus, IconTrash } from '@tabler/icons-react';
import type { ApiToken } from '@infra/shared';
import { useCreateToken, useDeleteToken, useTokens } from '@/api/tokens';
import { apiErrorMessage } from '@/api/client';
import { notifyError, notifySuccess } from '@/utils/notify';
import { formatDateShort } from '@/utils/format';

export function TokensPage() {
  const { t } = useTranslation();
  const { data: tokens, isLoading } = useTokens();
  const create = useCreateToken();
  const del = useDeleteToken();
  const [opened, { open, close }] = useDisclosure(false);

  const form = useForm<{ tokenName: string }>({
    initialValues: { tokenName: '' },
    validate: { tokenName: (v) => (v.trim() ? null : t('validation.enterName')) },
  });

  const openCreate = () => {
    form.setValues({ tokenName: '' });
    open();
  };

  const submit = form.onSubmit(async (v) => {
    try {
      await create.mutateAsync({ tokenName: v.tokenName.trim() });
      close();
      notifySuccess(t('tokens.created'));
    } catch (e) {
      notifyError(apiErrorMessage(e));
    }
  });

  const doDelete = async (tok: ApiToken) => {
    if (!window.confirm(t('tokens.confirmDelete', { name: tok.tokenName }))) return;
    try {
      await del.mutateAsync(tok.uuid);
      notifySuccess(t('common.deleted'));
    } catch (e) {
      notifyError(apiErrorMessage(e));
    }
  };

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <div>
          <Title order={2}>{t('tokens.title')}</Title>
          <Text c="dimmed">{t('tokens.subtitle')}</Text>
        </div>
        <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
          {t('common.add')}
        </Button>
      </Group>

      <Table.ScrollContainer minWidth={640}>
        <Table verticalSpacing="sm" highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('tokens.colName')}</Table.Th>
              <Table.Th>{t('tokens.colToken')}</Table.Th>
              <Table.Th>{t('tokens.colCreated')}</Table.Th>
              <Table.Th>{t('tokens.colLastUsed')}</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {tokens?.map((tok) => (
              <Table.Tr key={tok.uuid}>
                <Table.Td>
                  <Text fw={600}>{tok.tokenName}</Text>
                </Table.Td>
                <Table.Td>
                  <CopyButton value={tok.token}>
                    {({ copied, copy }) => (
                      <Group gap={6} wrap="nowrap">
                        <Code>{`${tok.token.slice(0, 12)}…`}</Code>
                        <Tooltip label={copied ? t('tokens.copied') : t('tokens.copy')}>
                          <ActionIcon variant="subtle" color="gray" size="sm" onClick={copy}>
                            {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    )}
                  </CopyButton>
                </Table.Td>
                <Table.Td style={{ whiteSpace: 'nowrap' }}>
                  {formatDateShort(tok.createdAt)}
                </Table.Td>
                <Table.Td style={{ whiteSpace: 'nowrap' }}>
                  {tok.lastUsedAt ? formatDateShort(tok.lastUsedAt) : t('tokens.lastUsedNever')}
                </Table.Td>
                <Table.Td>
                  <Group justify="flex-end">
                    <ActionIcon variant="subtle" color="red" onClick={() => doDelete(tok)}>
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
            {!isLoading && tokens?.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={5}>
                  <Text c="dimmed" ta="center" py="md">
                    {t('tokens.empty')}
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      <Modal opened={opened} onClose={close} title={t('tokens.modalCreate')}>
        <form onSubmit={submit}>
          <Stack>
            <TextInput
              label={t('tokens.fieldName')}
              placeholder={t('tokens.namePlaceholder')}
              required
              data-autofocus
              {...form.getInputProps('tokenName')}
            />
            <Button type="submit" loading={create.isPending}>
              {t('tokens.create')}
            </Button>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}
