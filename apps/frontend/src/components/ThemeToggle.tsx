import { ActionIcon, Tooltip, useComputedColorScheme, useMantineColorScheme } from '@mantine/core';
import { IconMoon, IconSun } from '@tabler/icons-react';
import { flushSync } from 'react-dom';
import { useTranslation } from 'react-i18next';

/** Light/dark theme toggle. Mantine persists the choice in localStorage across reloads. */
export function ThemeToggle() {
  const { t } = useTranslation();
  const { setColorScheme } = useMantineColorScheme();
  // Resolves 'auto' to the actual scheme; getInitialValueInEffect avoids a first-render mismatch.
  const computed = useComputedColorScheme('light', { getInitialValueInEffect: true });
  const isDark = computed === 'dark';
  const label = isDark ? t('theme.light') : t('theme.dark');

  const toggle = () => {
    const next = isDark ? 'light' : 'dark';
    // Cross-fade the page via the View Transitions API; flushSync flips the scheme synchronously
    // inside the transition so the new colors are captured. Unsupported browsers swap instantly.
    const doc = document as Document & { startViewTransition?: (cb: () => void) => void };
    if (typeof doc.startViewTransition === 'function') {
      doc.startViewTransition(() => flushSync(() => setColorScheme(next)));
    } else {
      setColorScheme(next);
    }
  };

  return (
    <Tooltip label={label}>
      <ActionIcon variant="subtle" color="gray" aria-label={label} onClick={toggle}>
        {isDark ? <IconSun size={18} /> : <IconMoon size={18} />}
      </ActionIcon>
    </Tooltip>
  );
}
