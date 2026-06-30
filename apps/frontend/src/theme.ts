import { type CSSVariablesResolver, createTheme, type MantineColorsTuple } from '@mantine/core';

// Brand palette; primary is #FB7BE2 (shade 6).
const brand: MantineColorsTuple = [
  '#fff0fb',
  '#fbddf2',
  '#f3b8e1',
  '#ec90cf',
  '#e66ec0',
  '#e358b7',
  '#fb7be2',
  '#c83fa1',
  '#b3348f',
  '#9d287d',
];

// Neutral near-black dark scale. dark[7] = body, dark[6] = cards/inputs, dark[4] = borders,
// dark[2] = dimmed text, dark[0] = text.
const dark: MantineColorsTuple = [
  '#f5f5f5',
  '#d0d0d0',
  '#9a9a9a',
  '#6a6a6a',
  '#2b2b2b',
  '#1f1f1f',
  '#171717',
  '#0d0d0d',
  '#080808',
  '#030303',
];

// 'Twemoji Country Flags' must come FIRST so the polyfill renders flag emojis on
// Windows; non-flag glyphs fall through to Mulish. See main.tsx.
const FONT = "'Twemoji Country Flags', Mulish, -apple-system, Segoe UI, sans-serif";

export const theme = createTheme({
  primaryColor: 'brand',
  primaryShade: 6, // #FB7BE2
  autoContrast: true,
  luminanceThreshold: 0.45,
  colors: { brand, dark },
  fontFamily: FONT,
  headings: { fontFamily: FONT },
  defaultRadius: 'md',
});

// Light scheme overrides only. Dark derives from the `dark` tuple, so no dark overrides.
export const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {},
  light: {
    '--mantine-color-body': '#f8f9fa',
    '--mantine-color-text': '#000000',
    '--mantine-color-dimmed': '#3e454d',
  },
  dark: {},
});
