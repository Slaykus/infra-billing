import { defaultFilter } from 'cmdk';
import { IconCheck, IconChevronDown } from '@tabler/icons-react';
import { type ReactNode, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface ComboboxOption {
  /** '' marks the reset row ("—", "All providers"): muted, hidden while searching. */
  value: string;
  label: string;
  /** Quiet text at the right edge, in the row and in the trigger. */
  hint?: ReactNode;
  icon?: ReactNode;
  /** Extra search terms besides the label (kind code, host, ISO code…). */
  keywords?: string[];
  /** Group heading; groups keep the order in which they first appear. */
  group?: string;
}

interface ComboboxProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  /** Trigger text while nothing is picked and there is no reset row. */
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  /** Labels are codes (connector kinds): set them in the mono face. */
  mono?: boolean;
}

// Below this a search box is just noise: period, rate source, a couple of accounts.
const SEARCH_MIN_OPTIONS = 8;
// cmdk derives an item's value from its text when the value is empty, so the reset row needs one.
const RESET_ITEM = '__reset__';

export const comboboxTriggerClass =
  'flex h-9 w-full items-center justify-between gap-2 rounded-md border border-transparent bg-field px-3 py-2 text-sm outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring/40 focus-visible:ring-3 focus-visible:ring-ring/15 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40';

// Items are keyed by value (uuids stay unique even when names repeat), so the search runs over
// the label and keywords only. The reset row has none and drops out as soon as you type.
const filter = (_: string, search: string, keywords: string[] = []) =>
  defaultFilter(keywords.join(' '), search);

/**
 * The one dropdown for form fields and filters: a short scrolling list under the trigger, with a
 * search box once the list is long enough to need one.
 */
export function Combobox({
  id,
  value,
  onChange,
  options,
  placeholder,
  disabled,
  invalid,
  mono,
}: ComboboxProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const commandRef = useRef<HTMLDivElement>(null);
  const searchable = options.length >= SEARCH_MIN_OPTIONS;
  const selected = options.find((o) => o.value === value);
  const muted = !selected || selected.value === '';

  const groups: { heading?: string; items: ComboboxOption[] }[] = [];
  for (const o of options) {
    const group = groups.find((g) => g.heading === o.group);
    if (group) group.items.push(o);
    else groups.push({ heading: o.group, items: [o] });
  }

  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  return (
    // modal: without it the parent dialog's scroll lock swallows wheel events over the list.
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid || undefined}
          disabled={disabled}
          className={comboboxTriggerClass}
        >
          <span className="flex min-w-0 items-center gap-2">
            {selected?.icon}
            <span className={cn('truncate', mono && 'font-mono', muted && 'text-muted-foreground')}>
              {selected?.label ?? placeholder}
            </span>
            {selected?.hint && <span className="truncate text-xs text-ink-3">{selected.hint}</span>}
          </span>
          <IconChevronDown className="size-4 shrink-0 text-ink-3" stroke={1.5} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-(--radix-popover-trigger-width) p-0"
        align="start"
        // Without a search box nothing inside is focusable, so hand focus to the list itself:
        // otherwise the arrow keys and Enter go nowhere.
        onOpenAutoFocus={(e) => {
          if (searchable) return;
          e.preventDefault();
          commandRef.current?.focus();
        }}
      >
        <Command
          ref={commandRef}
          filter={filter}
          defaultValue={selected ? selected.value || RESET_ITEM : undefined}
          className="outline-none"
        >
          {searchable && <CommandInput placeholder={t('common.searchPlaceholder')} />}
          <CommandList className="max-h-72">
            <CommandEmpty>{t('common.nothingFound')}</CommandEmpty>
            {groups.map((g) => (
              <CommandGroup key={g.heading ?? ''} heading={g.heading}>
                {g.items.map((o) => (
                  <CommandItem
                    key={o.value}
                    value={o.value || RESET_ITEM}
                    keywords={o.value ? [o.label, ...(o.keywords ?? [])] : []}
                    onSelect={() => pick(o.value)}
                    className={cn(!o.value && 'text-ink-2')}
                  >
                    {o.icon}
                    <span className={cn('min-w-0 flex-1 truncate', mono && 'font-mono')}>
                      {o.label}
                    </span>
                    {o.hint && (
                      <span className="max-w-1/2 shrink-0 truncate pl-3 text-xs text-ink-3">
                        {o.hint}
                      </span>
                    )}
                    <IconCheck
                      className={cn(
                        'size-4 shrink-0',
                        o.value === value ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
