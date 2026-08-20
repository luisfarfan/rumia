'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Inbox, SearchX, TriangleAlert } from 'lucide-react';
import type { CapturedItem } from '@/lib/types';
import { useAsk } from '@/hooks/useAsk';
import { useHotkeys } from '@/hooks/useHotkeys';
import type { ItemsState } from '@/hooks/useItems';
import { healthOf } from '@/lib/pipeline';
import { EmptyState } from '@/components/ui/EmptyState';
import { ItemRowSkeleton } from '@/components/ui/Skeleton';
import { AskPanel } from './AskPanel';
import { FilterBar, type Facet } from './FilterBar';
import { ItemRow } from './ItemRow';
import { ItemReader } from './ItemReader';

const ORDER = ['News', 'Tutorial', 'Opinion', 'Documentation', 'Entertainment', 'Other', 'Unknown'];

export function BoardView({ state, active }: { state: ItemsState; active: boolean }) {
  const { items, loading, error, arrivals } = state;

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [onlyIssues, setOnlyIssues] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const ask = useAsk();
  const searchRef = useRef<HTMLInputElement>(null);
  const askRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const issueCount = useMemo(
    () => items.filter((item) => healthOf(item) === 'partial' || healthOf(item) === 'failed').length,
    [items],
  );

  const facets = useMemo<Facet[]>(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      const key = item.category || 'Unknown';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const present = [...counts.entries()].sort(
      (a, b) => ORDER.indexOf(a[0]) - ORDER.indexOf(b[0]) || b[1] - a[1],
    );
    return [{ key: 'All', count: items.length }, ...present.map(([key, count]) => ({ key, count }))];
  }, [items]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      if (category !== 'All' && (item.category || 'Unknown') !== category) return false;
      if (onlyIssues) {
        const health = healthOf(item);
        if (health !== 'partial' && health !== 'failed') return false;
      }
      if (!needle) return true;
      return [item.title, item.rawInput, item.content, item.type, item.tags?.join(' ')].some(
        (field) => field?.toLowerCase().includes(needle),
      );
    });
  }, [items, query, category, onlyIssues]);

  const selected = useMemo(
    () => visible.find((item) => item.id === selectedId) ?? null,
    [visible, selectedId],
  );

  // A filter change can hide whatever was open; the reader should close rather
  // than keep showing a row that is no longer on the board.
  useEffect(() => {
    if (selectedId && !visible.some((item) => item.id === selectedId)) setSelectedId(null);
  }, [visible, selectedId]);

  const step = (delta: number) => {
    if (!visible.length) return;
    const current = visible.findIndex((item) => item.id === selectedId);
    const next = current === -1 ? 0 : Math.min(visible.length - 1, Math.max(0, current + delta));
    setSelectedId(visible[next].id);
    listRef.current
      ?.querySelectorAll('article')
      [next]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };

  // The board stays mounted behind the graph tab so its scroll position and
  // open reader survive the switch; its shortcuts must not stay live too.
  const onBoard =
    (fn: (event: KeyboardEvent) => void) =>
    (event: KeyboardEvent) => {
      if (!active) return;
      event.preventDefault();
      fn(event);
    };

  useHotkeys({
    '/': onBoard(() => searchRef.current?.focus()),
    // Plain letters, not Cmd+K: the hook rejects anything with a modifier.
    k: onBoard(() => step(-1)),
    j: onBoard(() => step(1)),
    ArrowUp: onBoard(() => step(-1)),
    ArrowDown: onBoard(() => step(1)),
    '?': onBoard(() => askRef.current?.focus()),
    Escape: onBoard(() => {
      if (selectedId) setSelectedId(null);
      else if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    }),
  });

  return (
    <div className="flex min-h-0 flex-1">
      <section className="flex min-w-0 flex-1 flex-col">
        <div className="shrink-0 border-b border-rule px-5 pt-4 pb-3.5">
          <AskPanel ref={askRef} state={ask} />
          <div className="mt-3.5">
            <FilterBar
              ref={searchRef}
              query={query}
              onQuery={setQuery}
              facets={facets}
              category={category}
              onCategory={setCategory}
              onlyIssues={onlyIssues}
              onOnlyIssues={setOnlyIssues}
              issueCount={issueCount}
            />
          </div>
        </div>

        {error && (
          <p className="flex items-center gap-2 border-b border-bad-line bg-bad-soft px-5 py-2 text-xs text-bad">
            <TriangleAlert size={13} aria-hidden="true" />
            {error} Se reintenta cada diez segundos.
          </p>
        )}

        <div ref={listRef} className="scroll-y flex flex-1 flex-col">
          {loading ? (
            Array.from({ length: 6 }, (_, i) => <ItemRowSkeleton key={i} index={i} />)
          ) : items.length === 0 ? (
            <EmptyState icon={Inbox} title="Todavía no has guardado nada">
              Manda un enlace, una foto o una nota de voz al bot de Telegram y aparecerá aquí en
              cuanto termine de procesarse.
            </EmptyState>
          ) : visible.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="Ninguna entrada encaja con el filtro"
              action={
                <button
                  type="button"
                  className="btn btn-sm mt-1"
                  onClick={() => {
                    setQuery('');
                    setCategory('All');
                    setOnlyIssues(false);
                  }}
                >
                  Quitar los filtros
                </button>
              }
            >
              Hay {items.length} entradas guardadas, pero ninguna coincide con lo que buscas.
            </EmptyState>
          ) : (
            visible.map((item: CapturedItem) => (
              <ItemRow
                key={item.id}
                item={item}
                selected={item.id === selectedId}
                isNew={arrivals.has(item.id)}
                onSelect={() => setSelectedId(item.id === selectedId ? null : item.id)}
              />
            ))
          )}
        </div>
      </section>

      {selected && (
        <>
          {/* Below lg the reader takes the screen: a 450px column stacked under
              an endless list means scrolling past everything to read one item. */}
          <div
            className="animate-fade fixed inset-0 z-30 bg-ink/25 lg:hidden"
            onClick={() => setSelectedId(null)}
            aria-hidden="true"
          />
          <aside
            className="animate-slide-in fixed inset-y-0 right-0 z-40 flex w-full max-w-[560px] flex-col border-l border-rule shadow-float lg:static lg:z-auto lg:w-[46%] lg:min-w-[420px] lg:max-w-[620px] lg:shadow-none"
            aria-label="Entrada seleccionada"
          >
            <ItemReader item={selected} onClose={() => setSelectedId(null)} />
          </aside>
        </>
      )}
    </div>
  );
}
