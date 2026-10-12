import { IconActivity, IconArrowUpRight, IconTag } from '@tabler/icons-react';
import dayjs from 'dayjs';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useBuildInfo } from '@/api/buildInfo';
import {
  GITHUB_DEV_BRANCH_URL,
  githubCommitUrl,
  githubReleaseUrl,
  useLatestRelease,
} from '@/api/github';
import { CopyButton } from '@/components/CopyButton';
import { Button } from '@/components/ui/button';
import { InkGlyph, type InkState } from '@/components/ink/InkGlyph';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Skeleton } from '@/components/ui/skeleton';
import { SidebarLinkRow } from '@/layout/SidebarLinkRow';
import { isNewerVersion, isReleaseVersion } from '@/lib/version';

const DATE_FORMAT = 'DD.MM.YYYY HH:mm';

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-ink-2">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </>
  );
}

type Status = 'dev' | 'update' | 'current' | 'unknown' | 'pending';

const STATUS_GLYPH: Record<Status, InkState | null> = {
  dev: 'pending',
  update: 'warn',
  current: 'ok',
  unknown: null,
  pending: null,
};

export function BuildInfo() {
  const { t } = useTranslation();
  const { data, isPending } = useBuildInfo();
  const version = data?.version ?? '';
  // Not a tagged release: nothing to compare against, and the dev branch is where it comes from.
  const isDev = version !== '' && !isReleaseVersion(version);
  const release = useLatestRelease(version !== '' && !isDev);
  const latest = release.data;
  const hasUpdate = !isDev && latest != null && isNewerVersion(latest, version);

  if (isPending) return <Skeleton className="mx-2.5 my-2 h-4 w-28 rounded-sm" />;
  if (!data) return null;

  // "" is the env default, "unknown" is what `task docker-build` passes outside a git checkout.
  const commit = data.gitCommit && data.gitCommit !== 'unknown' ? data.gitCommit : '';
  const built = data.buildTime ? dayjs(data.buildTime) : null;
  const builtAt = built?.isValid() ? built : null;
  const label = isDev ? 'dev' : `v${version}`;
  const releaseUrl = isDev ? GITHUB_DEV_BRANCH_URL : githubReleaseUrl(version);

  let status: Status = 'pending';
  if (isDev) status = 'dev';
  else if (hasUpdate) status = 'update';
  else if (latest) status = 'current';
  else if (release.isError) status = 'unknown';
  const statusText: Record<Status, string> = {
    dev: t('build.devBuild'),
    update: t('build.updateAvailable', { version: latest }),
    current: t('build.upToDate'),
    unknown: t('build.checkUnavailable'),
    pending: '',
  };

  const statusGlyph = STATUS_GLYPH[status];
  const none = t('common.none');
  const plainText = [
    `${t('app.brand')} ${label}`,
    ...(isDev && version !== 'dev' ? [`${t('build.version')}: ${version}`] : []),
    `${t('build.date')}: ${builtAt ? `${builtAt.format(DATE_FORMAT)} (${data.buildTime})` : none}`,
    `${t('build.commit')}: ${commit || none}`,
    `${t('build.node')}: ${data.nodeVersion || none}`,
  ].join('\n');

  return (
    <HoverCard openDelay={200} closeDelay={150}>
      <HoverCardTrigger asChild>
        {/* A quiet row at the foot of the sidebar; an available update adds the attention dot. A
            dev build reads "dev", so it is never mistaken for a release. */}
        <SidebarLinkRow
          href={releaseUrl}
          icon={IconTag}
          aria-label={isDev ? t('build.openDevBranch') : t('build.openRelease', { version })}
          trailing={hasUpdate ? <InkGlyph state="warn" size={9} /> : null}
        >
          {t('build.version')} {isDev ? 'dev' : version}
        </SidebarLinkRow>
      </HoverCardTrigger>

      {/* Radix HoverCard is a pointer preview: it sets tabindex=-1 on everything inside, so the
          copy buttons and links here are mouse-only. The pill itself is the keyboard path. */}
      <HoverCardContent
        side="right"
        align="end"
        sideOffset={12}
        collisionPadding={8}
        className="w-80 rounded-xl p-0"
      >
        <div className="flex items-start gap-3 border-b border-hairline p-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-background text-ink-2">
            <IconActivity className="size-5" stroke={1.5} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-lg leading-tight font-medium">{label}</p>
            {statusText[status] ? (
              <p className="mt-1 flex items-center gap-1.5 text-[13px] text-ink-2">
                {statusGlyph ? <InkGlyph state={statusGlyph} size={10} /> : null}
                {statusText[status]}
              </p>
            ) : null}
          </div>
          <CopyButton text={plainText} label={t('build.copyAll')} className="-mt-1 -mr-1" />
        </div>

        {hasUpdate && latest ? (
          <a
            href={githubReleaseUrl(latest)}
            target="_blank"
            rel="noopener noreferrer"
            className="mx-4 mt-4 flex items-center justify-between gap-2 rounded-lg bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
          >
            <span>{t('build.whatsNew', { version: latest })}</span>
            <IconArrowUpRight className="size-4 shrink-0" />
          </a>
        ) : null}

        <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-5 gap-y-2.5 p-4 text-sm">
          {isDev && version !== 'dev' ? <Fact label={t('build.version')}>{version}</Fact> : null}
          <Fact label={t('build.date')}>
            {builtAt ? (
              <>
                <span>{builtAt.format(DATE_FORMAT)}</span>
                <span className="block text-xs text-ink-2">{builtAt.fromNow()}</span>
              </>
            ) : (
              none
            )}
          </Fact>
          <Fact label={t('build.commit')}>
            {commit ? (
              <span className="flex items-center gap-1.5">
                <a
                  href={githubCommitUrl(commit)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-sm bg-background px-1.5 py-0.5 font-mono text-xs transition-colors hover:bg-accent"
                >
                  {commit.slice(0, 7)}
                </a>
                <CopyButton text={commit} label={t('build.copy')} />
              </span>
            ) : (
              none
            )}
          </Fact>
          <Fact label={t('build.node')}>{data.nodeVersion || none}</Fact>
        </dl>

        <div className="border-t border-hairline p-2">
          <Button asChild variant="ghost" size="sm" className="w-full justify-between">
            <a href={releaseUrl} target="_blank" rel="noopener noreferrer">
              {isDev ? t('build.devBranch') : t('build.releaseNotes', { version })}
              <IconArrowUpRight className="size-4 text-ink-3" />
            </a>
          </Button>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
