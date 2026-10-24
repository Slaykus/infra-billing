import { IconBrandGithub, IconStar } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { GITHUB_REPO_URL, useGithubStars } from '@/api/github';
import { SidebarLinkRow } from '@/layout/SidebarLinkRow';

/** Sidebar link to the repository; the star count rides along once GitHub has answered. */
export function GithubStars() {
  const { t } = useTranslation();
  const { data: stars } = useGithubStars();

  return (
    <SidebarLinkRow
      href={GITHUB_REPO_URL}
      icon={IconBrandGithub}
      aria-label={t('app.starOnGithub')}
      trailing={
        stars == null ? null : (
          <span className="flex shrink-0 items-center gap-1 text-xs text-ink-3">
            <IconStar aria-hidden stroke={1.5} className="size-3" />
            {stars}
          </span>
        )
      }
    >
      {t('app.github')}
    </SidebarLinkRow>
  );
}
