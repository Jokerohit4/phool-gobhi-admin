'use client';

import { useEffect, useState } from 'react';
import {
  bootstrapLoaderFacts,
  nextLoaderFact,
  type LoaderAudience,
  type LoaderFact as Fact,
} from '@/lib/loader-facts';

interface LoaderFactProps {
  audience?: LoaderAudience;
  /** Skip the fact entirely for loads that finish faster than this. */
  minVisibleMs?: number;
  rotateMs?: number;
  className?: string;
}

/**
 * One "did you know" line for a spinner. Drop it directly under any loading
 * copy: <LoaderFact />. It reserves two lines so the layout never shifts.
 */
export default function LoaderFact({
  audience = 'admin',
  minVisibleMs = 400,
  rotateMs = 3200,
  className = '',
}: LoaderFactProps) {
  const [fact, setFact] = useState<Fact | null>(null);

  useEffect(() => {
    let cancelled = false;
    let ticker: ReturnType<typeof setInterval> | undefined;

    const start = setTimeout(async () => {
      if (cancelled) return;
      await bootstrapLoaderFacts(audience);
      if (cancelled) return;
      setFact(nextLoaderFact());

      ticker = setInterval(() => {
        // Don't burn the 10-fact window while the tab is in the background.
        if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
        setFact(nextLoaderFact());
      }, rotateMs);
    }, minVisibleMs);

    return () => {
      cancelled = true;
      clearTimeout(start);
      if (ticker) clearInterval(ticker);
    };
  }, [audience, minVisibleMs, rotateMs]);

  return (
    <p
      aria-hidden="true"
      className={`mx-auto min-h-[2.5rem] max-w-md text-balance text-center text-sm leading-5 text-gray-500 dark:text-gray-400 ${className}`}
    >
      {fact?.text ?? ''}
    </p>
  );
}
