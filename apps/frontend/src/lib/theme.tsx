import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';

export type ColorScheme = 'light' | 'dark' | 'auto';
/** How brand imagery is tinted (the `icon-tint` utility in index.css). */
export type IconColors = 'mono' | 'warm' | 'color';

const STORAGE_KEY = 'color-scheme';
const ICON_COLORS_KEY = 'icon-colors';

interface ThemeContextValue {
  scheme: ColorScheme;
  /** 'auto' resolved to the effective scheme via prefers-color-scheme. */
  resolved: 'light' | 'dark';
  setScheme: (scheme: ColorScheme) => void;
  iconColors: IconColors;
  setIconColors: (mode: IconColors) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function systemScheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function readStored(): ColorScheme {
  const v = localStorage.getItem(STORAGE_KEY);
  return v === 'light' || v === 'dark' || v === 'auto' ? v : 'auto';
}

function readIconColors(): IconColors {
  const v = localStorage.getItem(ICON_COLORS_KEY);
  return v === 'warm' || v === 'color' ? v : 'mono';
}

/** Toggles .dark on <html> synchronously — matters for View Transitions (see ThemeToggle). */
function applyScheme(resolved: 'light' | 'dark') {
  document.documentElement.classList.toggle('dark', resolved === 'dark');
  // index.html sets a boot background (pre-paint, /login) — React owns theming from here.
  document.documentElement.style.removeProperty('background-color');
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [scheme, setSchemeState] = useState<ColorScheme>(readStored);
  const [system, setSystem] = useState<'light' | 'dark'>(systemScheme);
  const [iconColors, setIconColorsState] = useState<IconColors>(readIconColors);

  const resolved = scheme === 'auto' ? system : scheme;

  // useLayoutEffect runs synchronously during commit: flushSync(setScheme) inside
  // startViewTransition swaps the class before the new frame is snapshotted, and on
  // first render the class lands before paint (no flash of the light theme).
  useLayoutEffect(() => applyScheme(resolved), [resolved]);
  // No attribute reads as mono in CSS, so the default needs no pre-paint script.
  useLayoutEffect(() => {
    document.documentElement.dataset.iconColors = iconColors;
  }, [iconColors]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setSystem(systemScheme());
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const setScheme = useCallback((next: ColorScheme) => {
    localStorage.setItem(STORAGE_KEY, next);
    setSchemeState(next);
  }, []);

  const setIconColors = useCallback((next: IconColors) => {
    localStorage.setItem(ICON_COLORS_KEY, next);
    setIconColorsState(next);
  }, []);

  const value = useMemo(
    () => ({ scheme, resolved, setScheme, iconColors, setIconColors }),
    [scheme, resolved, setScheme, iconColors, setIconColors],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = use(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
