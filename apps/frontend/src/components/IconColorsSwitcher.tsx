import { IconCheck, IconPalette, IconPaletteOff } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { type IconColors, useTheme } from '@/lib/theme';

const MODES: IconColors[] = ['mono', 'warm', 'color'];

/** Picks how favicons, icon tiles and markers are tinted; sits between the theme and language. */
export function IconColorsSwitcher() {
  const { t } = useTranslation();
  const { iconColors, setIconColors } = useTheme();
  const label = t('iconColors.label');
  const Glyph = iconColors === 'mono' ? IconPaletteOff : IconPalette;

  return (
    <Tooltip>
      <DropdownMenu>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`${label} · ${t(`iconColors.${iconColors}`)}`}
              className="text-ink-3 hover:text-foreground"
            >
              <Glyph stroke={1.5} className="size-4" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <DropdownMenuContent
          align="end"
          className="w-40"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          {MODES.map((mode) => (
            <DropdownMenuItem key={mode} onClick={() => setIconColors(mode)}>
              <span className="flex-1">{t(`iconColors.${mode}`)}</span>
              {iconColors === mode ? <IconCheck className="size-3.5" /> : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
