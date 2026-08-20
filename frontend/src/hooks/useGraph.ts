'use client';

import { useEffect, useState } from 'react';
import type { GraphData } from '@/lib/types';

export interface GraphState {
  data: GraphData;
  loading: boolean;
  error: string | null;
}

const EMPTY: GraphData = { nodes: [], links: [] };

export function useGraph(): GraphState {
  const [data, setData] = useState<GraphData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/graph')
      .then(async (res) => {
        if (!res.ok) throw new Error(`El servidor respondió ${res.status}.`);
        return (await res.json()) as GraphData;
      })
      .then((next) => {
        if (cancelled) return;
        setData(next?.nodes ? next : EMPTY);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'No se pudo leer el grafo.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { data, loading, error };
}
