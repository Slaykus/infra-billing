import { IconArrowUpRight, IconCheck, IconCopy } from '@tabler/icons-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import rwpLogo from '@/assets/rwp-logo.svg';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const RWP_URL = 'https://rwp.rw/';
const PROMO_CODE = 'MISH';

/** Header promo for RWP Shop (rwp.rw) — the first Remnawave bot, integrates with Infra Billing. */
export function RwpPromo() {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const copy = () => {
    void navigator.clipboard.writeText(PROMO_CODE);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="rounded-full hover:-translate-y-px hover:border-cyan-500/60 hover:shadow-[0_2px_12px_-6px_theme(colors.cyan.400)]"
          aria-label={t('app.rwp.title')}
        >
          <img src={rwpLogo} alt="" className="size-4" />
          <span className="text-sm leading-none font-semibold">RWP</span>
          <Badge className="border-transparent bg-cyan-500/15 px-1.5 py-0 text-[11px] font-bold text-cyan-600 dark:text-cyan-400">
            −15%
          </Badge>
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center gap-3 border-b p-4">
          {/* The RWP mark is drawn for a dark backdrop — keep it on the brand navy in both themes. */}
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#161b23]">
            <img src={rwpLogo} alt="RWP" className="size-7" />
          </div>
          <div className="flex items-center gap-2 font-semibold">
            {t('app.rwp.title')}
            <Badge className="border-transparent bg-cyan-500/15 px-1.5 py-0 text-[11px] font-bold text-cyan-600 dark:text-cyan-400">
              −15%
            </Badge>
          </div>
        </div>

        <div className="space-y-3 p-4">
          <p className="text-sm text-muted-foreground">{t('app.rwp.description')}</p>

          <button
            type="button"
            onClick={copy}
            aria-label={copied ? t('app.rwp.copied') : t('app.rwp.copy')}
            className="flex w-full items-center justify-between gap-2 rounded-lg border border-dashed border-cyan-500/40 bg-cyan-500/5 px-3 py-2 text-left transition-colors hover:bg-cyan-500/10"
          >
            <span className="text-xs text-muted-foreground">
              {copied ? t('app.rwp.copied') : t('app.rwp.promo')}
            </span>
            <span className="flex items-center gap-1.5 font-mono text-sm font-bold tracking-widest text-cyan-600 dark:text-cyan-400">
              {PROMO_CODE}
              {copied ? (
                <IconCheck className="size-3.5" />
              ) : (
                <IconCopy className="size-3.5 text-muted-foreground" />
              )}
            </span>
          </button>

          <Button asChild size="sm" className="w-full">
            <a href={RWP_URL} target="_blank" rel="noopener noreferrer">
              {t('app.rwp.open')}
              <IconArrowUpRight className="size-4" />
            </a>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
