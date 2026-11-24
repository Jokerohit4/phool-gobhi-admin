'use client';

import { Button } from './Button';

export function PrintButton({ label = 'Print or save as PDF' }: { label?: string }) {
  return (
    <Button type="button" onClick={() => window.print()}>
      {label}
    </Button>
  );
}
