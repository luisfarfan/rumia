'use client';

import { ENTITY_TYPES, entityColor, type Theme } from '@/lib/entities';

/**
 * The legend is also the filter. A static colour key makes the reader hold six
 * hue-to-meaning pairs in their head; toggling a type off answers the same
 * question by removing everything else.
 */
export function GraphLegend({
  counts,
  hidden,
  onToggle,
  onReset,
  theme,
}: {
  counts: Map<string, number>;
  hidden: Set<string>;
  onToggle: (label: string) => void;
  onReset: () => void;
  theme: Theme;
}) {
  const present = ENTITY_TYPES.filter((type) => (counts.get(type.key) ?? 0) > 0);
  if (!present.length) return null;

  return (
    <div className="panel absolute top-4 left-4 z-10 max-w-[15rem] p-2.5 shadow-panel">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h4 className="u-label">Tipos</h4>
        {hidden.size > 0 && (
          <button
            type="button"
            onClick={onReset}
            className="text-2xs text-accent transition-colors hover:text-accent-hover"
          >
            ver todo
          </button>
        )}
      </div>

      <ul className="flex flex-col gap-0.5">
        {present.map((type) => {
          const off = hidden.has(type.key);
          return (
            <li key={type.key}>
              <button
                type="button"
                onClick={() => onToggle(type.key)}
                aria-pressed={!off}
                className={`flex w-full items-center gap-2 rounded-xs px-1.5 py-1 text-xs transition-colors ${
                  off ? 'text-faint' : 'text-ink hover:bg-hover'
                }`}
              >
                <span
                  className="size-2.5 shrink-0 rounded-full transition-opacity"
                  style={{
                    backgroundColor: entityColor(type.key, theme),
                    opacity: off ? 0.22 : 1,
                  }}
                  aria-hidden="true"
                />
                <span className={`flex-1 text-left ${off ? 'line-through' : ''}`}>{type.name}</span>
                <span className="font-mono text-2xs text-faint">{counts.get(type.key)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
