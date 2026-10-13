import type { Provider } from '@infra/shared';
import { Combobox, type ComboboxOption } from '@/components/Combobox';
import { ProviderIcon } from '@/components/ProviderIcon';
import { providerFavicon } from '@/utils/favicon';

interface ProviderComboboxProps {
  id?: string;
  providers: Provider[] | undefined;
  value: string;
  onChange: (uuid: string) => void;
  placeholder?: string;
  /** Adds a leading row that clears the value ("All providers" in filters). */
  resetLabel?: string;
  disabled?: boolean;
  invalid?: boolean;
}

/** Provider picker: favicon, name and the connector kind, searchable by name or kind. */
export function ProviderCombobox({
  id,
  providers,
  value,
  onChange,
  placeholder,
  resetLabel,
  disabled,
  invalid,
}: ProviderComboboxProps) {
  const options: ComboboxOption[] = [...(providers ?? [])]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((p) => ({
      value: p.uuid,
      label: p.name,
      icon: (
        <ProviderIcon
          name={p.name}
          src={providerFavicon(p)}
          iconName={p.iconName}
          iconBg={p.iconBg}
          size={16}
        />
      ),
      // "manual" on half the rows is noise; the API kind tells billmgr/hostbill panels apart.
      hint: p.kind === 'manual' ? undefined : <span className="font-mono">{p.kind}</span>,
      keywords: [p.kind],
    }));
  if (resetLabel) options.unshift({ value: '', label: resetLabel });

  return (
    <Combobox
      id={id}
      value={value}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
      disabled={disabled}
      invalid={invalid}
    />
  );
}
