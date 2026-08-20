'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CapturedItem } from '@/lib/types';

const POLL_MS = 10_000;

export interface ItemsState {
  items: CapturedItem[];
  loading: boolean;
  error: string | null;
  /** Ids that were absent on the previous poll, so the board can mark what is
   *  new without flashing every row on every refresh. */
  arrivals: Set<string>;
  refresh: () => void;
}

/**
 * Ingestion is asynchronous — a link sent to the bot lands here a minute
 * later — so without polling the board is stale the moment it renders.
 */
export function useItems(): ItemsState {
  const [items, setItems] = useState<CapturedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [arrivals, setArrivals] = useState<Set<string>>(new Set());

  const seen = useRef<Set<string> | null>(null);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch('/api/items');
        if (!res.ok) throw new Error(`El servidor respondió ${res.status}.`);
        const data: unknown = await res.json();
        if (cancelled) return;

        const next = Array.isArray(data) ? (data as CapturedItem[]) : [];
        const ids = new Set(next.map((i) => i.id));

        // The first load is not an arrival: everything would glow at once.
        setArrivals(
          seen.current === null
            ? new Set()
            : new Set([...ids].filter((id) => !seen.current!.has(id))),
        );
        seen.current = ids;

        setItems(next);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        // Surfaced rather than logged: a board frozen at the last good poll
        // looks identical to a board with nothing new.
        setError(err instanceof Error ? err.message : 'No se pudo leer la base.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [tick]);

  return { items, loading, error, arrivals, refresh };
}
