import { IconMapPin } from '@tabler/icons-react';
import { Combobox } from '@/components/Combobox';
import { CountryFlag } from '@/components/CountryFlag';

interface CountryComboboxProps {
  /** ISO2 code, or '' when unset. */
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  /** Shown in the trigger when unset and as the "clear" item label. */
  placeholder: string;
  id?: string;
}

/** Country picker: flag and localized name, searchable by name or ISO code. */
export function CountryCombobox({
  value,
  onChange,
  options,
  placeholder,
  id,
}: CountryComboboxProps) {
  return (
    <Combobox
      id={id}
      value={value}
      onChange={onChange}
      options={[
        {
          value: '',
          label: placeholder,
          icon: <IconMapPin className="size-4 shrink-0 text-ink-3" />,
        },
        ...options.map((o) => ({
          ...o,
          icon: <CountryFlag code={o.value} />,
          keywords: [o.value],
        })),
      ]}
    />
  );
}
