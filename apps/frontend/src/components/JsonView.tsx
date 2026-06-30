import { Box, ScrollArea } from '@mantine/core';
import type { ReactNode } from 'react';

// Brand-tinted palette; light-dark() keeps it readable in either color scheme.
const COLOR = {
  key: 'light-dark(var(--mantine-color-brand-7), var(--mantine-color-brand-3))',
  string: 'light-dark(var(--mantine-color-teal-7), var(--mantine-color-teal-3))',
  number: 'light-dark(var(--mantine-color-blue-6), var(--mantine-color-blue-3))',
  boolean: 'light-dark(var(--mantine-color-grape-6), var(--mantine-color-grape-3))',
  nul: 'var(--mantine-color-dimmed)',
};

// Tokenize pretty-printed JSON into colored spans. Safe by construction (no innerHTML).
function highlight(json: string): ReactNode[] {
  const re =
    /("(?:\\.|[^"\\])*"(?:\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (let m = re.exec(json); m !== null; m = re.exec(json)) {
    if (m.index > last) out.push(json.slice(last, m.index));
    const tok = m[0];
    let color: string;
    if (tok.startsWith('"')) color = tok.trimEnd().endsWith(':') ? COLOR.key : COLOR.string;
    else if (tok === 'true' || tok === 'false') color = COLOR.boolean;
    else if (tok === 'null') color = COLOR.nul;
    else color = COLOR.number;
    out.push(
      <span key={key} style={{ color }}>
        {tok}
      </span>,
    );
    key += 1;
    last = re.lastIndex;
  }
  if (last < json.length) out.push(json.slice(last));
  return out;
}

/** Pretty, syntax-highlighted, scrollable view of an arbitrary JSON value. */
export function JsonView({ data, maxHeight = 460 }: { data: unknown; maxHeight?: number }) {
  const text = JSON.stringify(data, null, 2);
  return (
    <ScrollArea.Autosize mah={maxHeight} type="auto">
      <Box
        component="pre"
        style={{
          margin: 0,
          padding: 'var(--mantine-spacing-md)',
          background: 'light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-8))',
          border: '1px solid light-dark(var(--mantine-color-gray-2), var(--mantine-color-dark-4))',
          borderRadius: 'var(--mantine-radius-md)',
          fontFamily: 'var(--mantine-font-family-monospace)',
          fontSize: 'var(--mantine-font-size-xs)',
          lineHeight: 1.65,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          color: 'light-dark(var(--mantine-color-gray-7), var(--mantine-color-dark-1))',
        }}
      >
        {highlight(text)}
      </Box>
    </ScrollArea.Autosize>
  );
}
