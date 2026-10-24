import { useTranslation } from 'react-i18next';
import { Combobox } from '@/components/Combobox';
import { DEFAULT_LOGIN_URLS } from './providerForm';

interface ProviderKindPickerProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
  id?: string;
}

// The control panel's host is the quickest way to tell connectors apart (billmgr vs hostbill,
// aeza vs vdsina…); self-hosted panels (BILLmanager, HostBill) have none.
const hostOf = (kind: string) => {
  const url = DEFAULT_LOGIN_URLS[kind];
  return url ? new URL(url).host.replace(/^www\./, '') : '';
};

/** Connector picker: "manual" first, then the API connectors alphabetically. */
export function ProviderKindPicker({
  value,
  onChange,
  options,
  disabled,
  id,
}: ProviderKindPickerProps) {
  const { t } = useTranslation();
  const manual = options.filter((o) => o.value === 'manual');
  const api = options
    .filter((o) => o.value !== 'manual')
    .sort((a, b) => a.label.localeCompare(b.label));
  const withHost = (group: string) => (o: { value: string; label: string }) => {
    const host = hostOf(o.value);
    return { ...o, group, hint: host || undefined, keywords: host ? [host] : [] };
  };

  return (
    <Combobox
      id={id}
      value={value}
      onChange={onChange}
      options={[
        ...manual.map(withHost(t('providers.kindPicker.noApi'))),
        ...api.map(withHost(t('providers.kindPicker.api'))),
      ]}
      disabled={disabled}
      mono
    />
  );
}
