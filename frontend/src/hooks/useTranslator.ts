'use client';

import { useCallback, useState } from 'react';

export interface TranslatorState {
  target: string;
  setTarget: (language: string) => void;
  /** Cache keyed by `${passageKey}::${target}`, so switching languages back and
   *  forth never re-asks the model for something already fetched. */
  get: (key: string) => string | undefined;
  pendingKey: string | null;
  error: string | null;
  translate: (key: string, text: string) => void;
  dismissError: () => void;
}

/**
 * Translation is on demand and never replaces the original: ingestion keeps the
 * source language on purpose, so this only ever adds a second view.
 */
export function useTranslator(defaultTarget: string): TranslatorState {
  const [override, setOverride] = useState<string | null>(null);
  const [cache, setCache] = useState<Record<string, string>>({});
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Left unset so it can follow the item being viewed; an explicit pick wins.
  const target = override ?? defaultTarget;

  const get = useCallback((key: string) => cache[`${key}::${target}`], [cache, target]);

  const translate = useCallback(
    async (key: string, text: string) => {
      const cacheKey = `${key}::${target}`;
      if (pendingKey || cache[cacheKey]) return;

      setPendingKey(key);
      setError(null);
      try {
        const res = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, target }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'No se pudo traducir.');
        setCache((prev) => ({ ...prev, [cacheKey]: data.translated }));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo traducir.');
      } finally {
        setPendingKey(null);
      }
    },
    [target, pendingKey, cache],
  );

  return {
    target,
    setTarget: setOverride,
    get,
    pendingKey,
    error,
    translate,
    dismissError: () => setError(null),
  };
}
