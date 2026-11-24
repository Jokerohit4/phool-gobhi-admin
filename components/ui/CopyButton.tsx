'use client';

import { useState } from 'react';
import { Button } from './Button';

// Copies text to the clipboard; the text is a plain prop so it can come from a
// Server Component.
export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  return (
    <Button
      type="button"
      variant="secondary"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setState('copied');
        } catch {
          setState('failed');
        }
        setTimeout(() => setState('idle'), 2000);
      }}
    >
      {state === 'copied' ? 'Copied' : state === 'failed' ? 'Could not copy' : label}
    </Button>
  );
}
