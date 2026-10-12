import { IconArrowUpRight, type Icon } from '@tabler/icons-react';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

// Quieter than the nav rows: secondary links at the foot of the sidebar, in soft gray until hovered.
// data-[state=open] keeps a row lit while its hover card (the build info) is showing.
const LINK_ROW =
  'flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[13px] text-ink-2 outline-none transition-colors hover:bg-background hover:text-foreground focus-visible:bg-background focus-visible:text-foreground data-[state=open]:bg-background data-[state=open]:text-foreground';

type SidebarLinkRowProps = ComponentProps<'a'> & {
  icon: Icon;
  /** Muted extra next to the label (star count, update dot). */
  trailing?: ReactNode;
};

/** An outbound link in the sidebar footer: icon, label, optional extra and the ↗ that says "new tab". */
export function SidebarLinkRow({
  icon: RowIcon,
  trailing,
  className,
  children,
  ...props
}: SidebarLinkRowProps) {
  return (
    <a target="_blank" rel="noopener noreferrer" className={cn(LINK_ROW, className)} {...props}>
      <RowIcon aria-hidden stroke={1.5} className="size-4 shrink-0 text-ink-3" />
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {trailing}
      <IconArrowUpRight aria-hidden stroke={1.5} className="size-3.5 shrink-0 text-ink-3" />
    </a>
  );
}
