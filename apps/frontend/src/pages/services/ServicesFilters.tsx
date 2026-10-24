import { IconFilter } from '@tabler/icons-react';
import type { Provider } from '@infra/shared';
import type { Dispatch, SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import type { ServiceFilter } from '@/api/services';
import { Combobox, type ComboboxOption } from '@/components/Combobox';
import { Segmented } from '@/components/ink/Segmented';
import { ProviderCombobox } from '@/components/ProviderCombobox';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

type Activity = 'all' | 'active' | 'inactive';

interface FilterProps {
  filter: ServiceFilter;
  setFilter: Dispatch<SetStateAction<ServiceFilter>>;
}

/** All · Active · Inactive in the header bar, bound to the persisted `isActive` filter. */
export function ServicesActivityControl({ filter, setFilter }: FilterProps) {
  const { t } = useTranslation();
  const value: Activity =
    filter.isActive === undefined ? 'all' : filter.isActive ? 'active' : 'inactive';
  return (
    <Segmented<Activity>
      ariaLabel={t('services.activityFilter')}
      value={value}
      onChange={(v) =>
        setFilter((f) => ({ ...f, isActive: v === 'all' ? undefined : v === 'active' }))
      }
      options={[
        { value: 'all', label: t('common.all') },
        { value: 'active', label: t('services.activityActive') },
        { value: 'inactive', label: t('services.activityInactive') },
      ]}
    />
  );
}

interface ServicesFilterPopoverProps extends FilterProps {
  providers: Provider[] | undefined;
  projectOptions: ComboboxOption[];
  typeOptions: ComboboxOption[];
}

/** Ghost "Filter" button in the header bar; the count shows how many selects narrow the list. */
export function ServicesFilterPopover({
  filter,
  setFilter,
  providers,
  projectOptions,
  typeOptions,
}: ServicesFilterPopoverProps) {
  const { t } = useTranslation();
  const count = [filter.providerUuid, filter.projectUuid, filter.type].filter(
    (v) => v !== undefined,
  ).length;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm">
          <IconFilter className="size-3.5" />
          {t('common.filter')}
          {count > 0 && <span className="text-ink-3">{count}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="services-filter-provider">{t('services.fieldProvider')}</Label>
          <ProviderCombobox
            id="services-filter-provider"
            providers={providers}
            value={filter.providerUuid ?? ''}
            onChange={(v) => setFilter((f) => ({ ...f, providerUuid: v || undefined }))}
            resetLabel={t('services.filterAllProviders')}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="services-filter-project">{t('services.fieldProject')}</Label>
          <Combobox
            id="services-filter-project"
            value={filter.projectUuid ?? ''}
            onChange={(v) => setFilter((f) => ({ ...f, projectUuid: v || undefined }))}
            options={[{ value: '', label: t('services.filterAllProjects') }, ...projectOptions]}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="services-filter-type">{t('services.fieldType')}</Label>
          <Combobox
            id="services-filter-type"
            value={filter.type ?? ''}
            onChange={(v) => setFilter((f) => ({ ...f, type: v || undefined }))}
            options={[{ value: '', label: t('services.filterAllTypes') }, ...typeOptions]}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
