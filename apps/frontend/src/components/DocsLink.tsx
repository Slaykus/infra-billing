import { ActionIcon, Tooltip } from '@mantine/core';
import { IconFileText } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { API_PREFIX } from '@infra/shared';
import { useBuildInfo } from '@/api/buildInfo';

/** Direct link to the Swagger UI, shown only when the backend has DOCS=true. */
export function DocsLink() {
  const { t } = useTranslation();
  const { data } = useBuildInfo();
  if (!data?.docs) return null;

  return (
    <Tooltip label={t('app.apiDocs')}>
      <ActionIcon
        component="a"
        href={`/${API_PREFIX}/docs`}
        target="_blank"
        rel="noopener noreferrer"
        variant="subtle"
        color="gray"
        aria-label={t('app.apiDocs')}
      >
        <IconFileText size={18} />
      </ActionIcon>
    </Tooltip>
  );
}
