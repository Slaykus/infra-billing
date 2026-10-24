import { IconFileText } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { API_PREFIX } from '@infra/shared';
import { useBuildInfo } from '@/api/buildInfo';
import { SidebarLinkRow } from '@/layout/SidebarLinkRow';

/** Sidebar link to the Swagger UI, shown only when the backend has DOCS=true. */
export function DocsLink() {
  const { t } = useTranslation();
  const { data } = useBuildInfo();
  if (!data?.docs) return null;

  return (
    <SidebarLinkRow href={`/${API_PREFIX}/docs`} icon={IconFileText}>
      {t('app.apiDocs')}
    </SidebarLinkRow>
  );
}
