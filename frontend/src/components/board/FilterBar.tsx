'use client';

import { forwardRef } from 'react';
import { Search, TriangleAlert, X } from 'lucide-react';
import { categoryName } from '@/lib/sources';

export interface Facet {
  key: string;
  count: number;
}

/**
 * Categories are derived from what is actually stored, with counts, instead of
 * a hardcoded list. A filter that leads to an empty board is a dead end the
 * reader has to discover by clicking.
 */
export const FilterBar = forwardRef<
  HTMLInputElement,
  {
    query: string;
    onQuery: (value: string) => void;
    facets: Facet[];
    category: string;
    onCategory: (value: string) => void;
    onlyIssues: boolean;
    onOnlyIssues: (value: boolean) => void;
    issueCount: number;
  }
>(function FilterBar(
  { query, onQuery, facets, category, onCategory, onlyIssues, onOnlyIssues, issueCount },
  ref,
) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="relative">
        <Search
          size={15}
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint"
          aria-hidden="true"
        />
        <input
          ref={ref}
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Filtrar por título, texto o fuente…"
          aria-label="Filtrar las entradas en pantalla"
          className="field pr-10 pl-9 [&::-webkit-search-cancel-button]:hidden"
        />
        {query ? (
          <button
            type="button"
            onClick={() => onQuery('')}
            aria-label="Borrar el filtro"
            className="absolute top-1/2 right-1.5 grid size-6 -translate-y-1/2 place-items-center rounded-xs text-faint transition-colors hover:bg-hover hover:text-ink"
          >
            <X size={13} aria-hidden="true" />
          </button>
        ) : (
          <kbd className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded-xs border border-rule px-1.5 py-0.5 font-mono text-2xs text-faint sm:block">
            /
          </kbd>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {facets.map((facet) => {
          const active = category === facet.key;
          return (
            <button
              key={facet.key}
              type="button"
              onClick={() => onCategory(facet.key)}
              aria-pressed={active}
              className={`inline-flex h-6.5 items-center gap-1.5 rounded-sm border px-2 text-xs font-medium transition-colors duration-150 ${
                active
                  ? 'border-accent bg-accent text-on-accent'
                  : 'border-rule bg-transparent text-muted hover:border-rule-strong hover:text-ink'
              }`}
            >
              {facet.key === 'All' ? 'Todo' : categoryName(facet.key)}
              <span className={`font-mono text-2xs ${active ? 'text-on-accent/70' : 'text-faint'}`}>
                {facet.count}
              </span>
            </button>
          );
        })}

        {issueCount > 0 && (
          <button
            type="button"
            onClick={() => onOnlyIssues(!onlyIssues)}
            aria-pressed={onlyIssues}
            title="Entradas que llegaron incompletas o fallaron"
            className={`ml-auto inline-flex h-6.5 items-center gap-1.5 rounded-sm border px-2 text-xs font-medium transition-colors duration-150 ${
              onlyIssues
                ? 'border-warn-line bg-warn-soft text-warn'
                : 'border-rule text-muted hover:border-warn-line hover:text-warn'
            }`}
          >
            <TriangleAlert size={12} aria-hidden="true" />
            Con problemas
            <span className="font-mono text-2xs opacity-70">{issueCount}</span>
          </button>
        )}
      </div>
    </div>
  );
});
