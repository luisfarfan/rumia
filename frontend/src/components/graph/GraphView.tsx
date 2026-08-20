'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { Maximize2, Minus, Network, Plus, Search, TriangleAlert } from 'lucide-react';
import type { GraphState } from '@/hooks/useGraph';
import type { GraphNode } from '@/lib/types';
import type { Theme } from '@/lib/entities';
import { plural } from '@/lib/format';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { GraphCanvas, type GraphHandle } from './GraphCanvas';
import { GraphLegend } from './GraphLegend';
import { NodeInspector } from './NodeInspector';

export function GraphView({ state, theme }: { state: GraphState; theme: Theme }) {
  const { data, loading, error } = state;
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [query, setQuery] = useState('');
  const canvas = useRef<GraphHandle | null>(null);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const node of data.nodes) map.set(node.label, (map.get(node.label) ?? 0) + 1);
    return map;
  }, [data.nodes]);

  /** Prefix matches first, then anything containing the query: typing "an"
   *  should offer Anthropic before Cloudflare. */
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length < 2) return [];
    const hits = data.nodes.filter((node) => node.name.toLowerCase().includes(needle));
    return hits
      .sort((a, b) => {
        const rank = (name: string) => (name.toLowerCase().startsWith(needle) ? 0 : 1);
        return rank(a.name) - rank(b.name) || a.name.length - b.name.length;
      })
      .slice(0, 6);
  }, [data.nodes, query]);

  const focus = useCallback((node: GraphNode) => {
    setSelected(node);
    setQuery('');
    canvas.current?.focus(node);
  }, []);

  const toggleType = (label: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });

  return (
    <div className="flex min-h-0 flex-1">
      <section className="relative min-w-0 flex-1 overflow-hidden bg-sunken">
        {loading ? (
          <div className="absolute inset-0 grid place-items-center">
            <div className="flex flex-col items-center gap-3">
              <Skeleton className="size-24 rounded-full" />
              <p className="text-xs text-faint">Trazando la red…</p>
            </div>
          </div>
        ) : error ? (
          <EmptyState icon={TriangleAlert} title="No se pudo leer el grafo">
            {error}
          </EmptyState>
        ) : data.nodes.length === 0 ? (
          <EmptyState icon={Network} title="Todavía no hay entidades">
            El grafo se llena en la última fase de la ingesta. Si el tablón tiene entradas y esto
            sigue vacío, es que el worker del grafo no está corriendo.
          </EmptyState>
        ) : (
          <>
            <GraphCanvas
              data={data}
              theme={theme}
              hidden={hidden}
              selected={selected}
              onSelect={setSelected}
              handleRef={canvas}
            />

            <GraphLegend
              counts={counts}
              hidden={hidden}
              onToggle={toggleType}
              onReset={() => setHidden(new Set())}
              theme={theme}
            />

            {/* Search sits over the canvas rather than in the sidebar: it acts
                on what is on screen, so it belongs on screen. */}
            <div className="absolute top-4 right-4 z-10 w-64">
              <div className="relative">
                <Search
                  size={14}
                  className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-faint"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && matches[0] && focus(matches[0])}
                  placeholder="Buscar una entidad…"
                  aria-label="Buscar una entidad en el grafo"
                  className="field h-8 pl-8 shadow-panel [&::-webkit-search-cancel-button]:hidden"
                />
              </div>
              {matches.length > 0 && (
                <ul className="panel animate-fade mt-1 overflow-hidden shadow-panel">
                  {matches.map((node) => (
                    <li key={node.id}>
                      <button
                        type="button"
                        onClick={() => focus(node)}
                        className="flex w-full items-baseline justify-between gap-2 px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-hover"
                      >
                        <span className="truncate text-ink">{node.name}</span>
                        <span className="shrink-0 font-mono text-2xs text-faint">{node.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="absolute right-4 bottom-4 z-10 flex items-center gap-1">
              <span className="tag mr-1">
                {data.nodes.length} {plural('entidad', data.nodes.length)} · {data.links.length}{' '}
                {plural('relacion', data.links.length)}
              </span>
              <button
                type="button"
                onClick={() => canvas.current?.zoomBy(1 / 1.4)}
                className="btn btn-icon btn-sm shadow-panel"
                aria-label="Alejar"
              >
                <Minus size={13} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => canvas.current?.zoomBy(1.4)}
                className="btn btn-icon btn-sm shadow-panel"
                aria-label="Acercar"
              >
                <Plus size={13} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => canvas.current?.fit()}
                className="btn btn-icon btn-sm shadow-panel"
                aria-label="Encajar toda la red"
                title="Encajar toda la red"
              >
                <Maximize2 size={12} aria-hidden="true" />
              </button>
            </div>
          </>
        )}
      </section>

      <aside
        className="scroll-y hidden w-[22rem] shrink-0 border-l border-rule bg-raised lg:flex lg:flex-col"
        aria-label="Entidad seleccionada"
      >
        <NodeInspector node={selected} data={data} theme={theme} onSelect={focus} />
      </aside>
    </div>
  );
}
