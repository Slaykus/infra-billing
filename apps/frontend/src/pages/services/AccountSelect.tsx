import type { Provider, ProviderAccount } from '@infra/shared';
import { useTranslation } from 'react-i18next';
import { Combobox } from '@/components/Combobox';
import { Label } from '@/components/ui/label';

export const accountsOf = (providers: Provider[] | undefined, providerUuid: string) =>
  providers?.find((p) => p.uuid === providerUuid)?.accounts ?? [];

/** The account a freshly picked provider implies: its only one, or none when there are several. */
export const impliedAccount = (accounts: ProviderAccount[]) =>
  accounts.length === 1 ? accounts[0].uuid : '';

interface AccountSelectProps {
  id: string;
  label: string;
  accounts: ProviderAccount[];
  value: string;
  onChange: (uuid: string) => void;
  disabled?: boolean;
  error?: string;
  className?: string;
}

/**
 * Account picker for service and payment forms. Rendered only for providers with several
 * accounts; a single-account provider fills the field silently.
 */
export function AccountSelect({
  id,
  label,
  accounts,
  value,
  onChange,
  disabled,
  error,
  className = 'space-y-2',
}: AccountSelectProps) {
  const { t } = useTranslation();
  return (
    <div className={className}>
      <Label htmlFor={id}>{label}</Label>
      <Combobox
        id={id}
        value={value}
        onChange={onChange}
        options={accounts.map((a) => ({
          value: a.uuid,
          label: a.label ?? t('common.accountMain'),
        }))}
        placeholder={t('validation.selectAccount')}
        disabled={disabled}
        invalid={!!error}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
