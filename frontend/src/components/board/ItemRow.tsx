'use client';

import { useState } from 'react';
import { Quote, TriangleAlert } from 'lucide-react';
import type { CapturedItem } from '@/lib/types';
import { excerpt, hostOf, languageName, relativeTime } from '@/lib/format';
import { categoryName, sourceIcon, sourceName } from '@/lib/sources';
import { healthOf } from '@/lib/pipeline';
import { PipelineTrack } from './PipelineTrack';

/**
 * A board row, not a card. Cards would force every item into the same box; the
 * content here is wildly uneven — a 37-character Reddit stub next to a 25 000
 * character LinkedIn page — and the row lets the thumbnail, the excerpt and the
 * failure notice each take only the space they have earned.
 */
export function ItemRow({
  item,
  selected,
  isNew,
  onSelect,
}: {
  item: CapturedItem;
  selected: boolean;
  isNew: boolean;
  onSelect: () => void;
}) {
  // CDN links expire; a broken frame is worse than no frame.
  const [thumbBroken, setThumbBroken] = useState(false);
  const health = healthOf(item);
  const Icon = sourceIcon(item.type);
  const showThumb = Boolean(item.thumbnailUrl) && !thumbBroken;
  const claims = item.verifications?.length ?? 0;
  const title = item.title?.trim() || hostOf(item.originalUrl) || item.rawInput || 'Sin título';
  const body = item.content?.trim();

  return (
    <article
      className={`group relative border-b border-rule transition-colors duration-150 last:border-b-0 ${
        selected ? 'bg-accent-soft' : 'hover:bg-hover'
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected}
        className="flex w-full gap-4 px-5 py-4 text-left focus-visible:outline-offset-[-2px]"
      >
        {/* Media, or a stand-in that says which kind of source this was. */}
        <span
          className={`relative grid size-[104px] shrink-0 place-items-center overflow-hidden rounded-sm border ${
            health === 'failed' ? 'border-bad-line bg-bad-soft' : 'border-rule bg-sunken'
          }`}
        >
          {showThumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.thumbnailUrl!}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setThumbBroken(true)}
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]"
            />
          ) : (
            <Icon
              size={26}
              strokeWidth={1.4}
              className={health === 'failed' ? 'text-bad/60' : 'text-faint'}
              aria-hidden="true"
            />
          )}
          {isNew && (
            <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-accent ring-2 ring-paper" />
          )}
        </span>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <span className="tag">
              <Icon size={11} strokeWidth={2} aria-hidden="true" />
              {sourceName(item.type)}
            </span>
            {item.category && item.category !== 'Unknown' && (
              <span className="tag tag-accent">{categoryName(item.category)}</span>
            )}
            {item.language && (
              <span className="tag" title={`Idioma detectado: ${languageName(item.language)}`}>
                {item.language.toUpperCase()}
              </span>
            )}
            {health === 'failed' && <span className="tag tag-bad">No se pudo leer</span>}
            {health === 'partial' && <span className="tag tag-warn">Incompleto</span>}
          </div>

          <h3
            className={`text-md leading-snug font-semibold text-balance transition-colors ${
              selected ? 'text-accent' : 'text-ink'
            }`}
          >
            {excerpt(title, 110)}
          </h3>

          {body && (
            <p className="mt-1 font-serif text-sm leading-relaxed text-muted">
              {excerpt(body, 165)}
            </p>
          )}

          {item.issue && (
            <p className="mt-2 flex items-start gap-1.5 text-xs leading-snug text-warn">
              <TriangleAlert size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>{excerpt(item.issue, 120)}</span>
            </p>
          )}

          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-faint">
            <PipelineTrack item={item} />
            <time dateTime={item.createdAt}>{relativeTime(item.createdAt)}</time>
            {claims > 0 && (
              <span className="inline-flex items-center gap-1">
                <Quote size={11} aria-hidden="true" />
                {claims} {claims === 1 ? 'afirmación' : 'afirmaciones'}
              </span>
            )}
            {item.tags && item.tags.length > 0 && (
              <span className="min-w-0 truncate font-mono">
                {item.tags.slice(0, 3).map((t) => `#${t}`).join(' ')}
              </span>
            )}
          </div>
        </div>
      </button>
    </article>
  );
}
