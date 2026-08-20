'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Ban, Clock, Languages, TriangleAlert, X } from 'lucide-react';
import type { CapturedItem } from '@/lib/types';
import { useTranslator } from '@/hooks/useTranslator';
import {
  absoluteTime,
  defaultTargetFor,
  excerpt,
  hostOf,
  languageName,
  readingMinutes,
  relativeTime,
  TRANSLATION_TARGETS,
} from '@/lib/format';
import { categoryName, sourceIcon, sourceName } from '@/lib/sources';
import { healthOf } from '@/lib/pipeline';
import { ClaimList } from './ClaimList';
import { PipelineDetail } from './PipelineTrack';

type TabKey = 'entry' | 'source' | 'claims' | 'record';

/**
 * The reading surface. Everything the pipeline produced for one item, in one
 * scroll region: the old sidebar stacked four independently scrolling boxes
 * inside a scrolling column, so a long transcript could only be read a
 * viewport-third at a time.
 */
export function ItemReader({ item, onClose }: { item: CapturedItem; onClose: () => void }) {
  const [tab, setTab] = useState<TabKey>('entry');
  const scroller = useRef<HTMLDivElement>(null);
  const translator = useTranslator(defaultTargetFor(item.language));

  const health = healthOf(item);
  const Icon = sourceIcon(item.type);
  const claims = item.verifications ?? [];
  const host = hostOf(item.originalUrl);

  const tabs = useMemo(() => {
    const list: Array<{ key: TabKey; label: string; badge?: number }> = [];
    if (item.content) list.push({ key: 'entry', label: 'Entrada' });
    // Kept as its own view rather than a second box below the entry: the whole
    // point is being able to flip between the model's rewrite and the words
    // that were actually said, in the same place on screen.
    if (item.transcript) list.push({ key: 'source', label: 'Palabras del original' });
    if (claims.length) list.push({ key: 'claims', label: 'Verificación', badge: claims.length });
    list.push({ key: 'record', label: 'Ficha' });
    return list;
  }, [item.content, item.transcript, claims.length]);

  // A new item resets the view: staying on "Verificación" while opening
  // something with no claims would show an empty pane.
  useEffect(() => {
    setTab(item.content ? 'entry' : 'record');
    scroller.current?.scrollTo({ top: 0 });
  }, [item.id, item.content]);

  const active = tabs.some((t) => t.key === tab) ? tab : tabs[0].key;

  return (
    <div className="flex h-full flex-col bg-raised">
      <header className="shrink-0 border-b border-rule px-5 pt-4 pb-0">
        <div className="mb-2.5 flex items-start gap-3">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            <span className="tag">
              <Icon size={11} strokeWidth={2} aria-hidden="true" />
              {sourceName(item.type)}
            </span>
            {item.category && item.category !== 'Unknown' && (
              <span className="tag tag-accent">{categoryName(item.category)}</span>
            )}
            {item.language && (
              <span className="tag">{languageName(item.language)}</span>
            )}
            {health === 'failed' && <span className="tag tag-bad">No se pudo leer</span>}
            {health === 'partial' && <span className="tag tag-warn">Incompleto</span>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost btn-sm btn-icon -mt-1 shrink-0"
            aria-label="Cerrar la entrada (Esc)"
            title="Cerrar · Esc"
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>

        <h2 className="text-xl leading-tight font-semibold text-balance text-ink">
          {item.title?.trim() || host || 'Sin título'}
        </h2>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-faint">
          <time dateTime={item.createdAt} title={absoluteTime(item.createdAt)}>
            {relativeTime(item.createdAt)}
          </time>
          {item.content && (
            <span className="inline-flex items-center gap-1">
              <Clock size={11} aria-hidden="true" />
              {readingMinutes(item.content)} min de lectura
            </span>
          )}
          {item.originalUrl && (
            <a
              href={item.originalUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex max-w-[240px] items-center gap-1 text-accent transition-colors hover:text-accent-hover"
            >
              <span className="truncate">{host}</span>
              <ArrowUpRight size={11} className="shrink-0" aria-hidden="true" />
            </a>
          )}
        </div>

        {item.issue && (
          <p className="mt-3 flex items-start gap-2 rounded-sm border border-warn-line bg-warn-soft px-3 py-2 text-xs leading-relaxed text-warn">
            <TriangleAlert size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              <strong className="font-semibold">Llegó incompleto.</strong> {item.issue}
            </span>
          </p>
        )}

        <div role="tablist" aria-label="Secciones de la entrada" className="-mb-px flex gap-4 pt-3.5">
          {tabs.map((t) => {
            const isActive = t.key === active;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setTab(t.key)}
                className={`relative pb-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
                  isActive ? 'text-ink' : 'text-faint hover:text-muted'
                }`}
              >
                {t.label}
                {t.badge !== undefined && (
                  <span className="ml-1.5 font-mono text-2xs text-faint">{t.badge}</span>
                )}
                {isActive && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-accent" />}
              </button>
            );
          })}
        </div>
      </header>

      <div ref={scroller} className="scroll-y flex-1 px-5 py-5">
        {active === 'entry' && item.content && (
          <Passage
            passageKey={`c-${item.id}`}
            text={item.content}
            note="Redactado por el modelo a partir de lo que se extrajo."
            translator={translator}
          />
        )}

        {active === 'source' && item.transcript && (
          <Passage
            passageKey={`t-${item.id}`}
            text={item.transcript}
            note="Lo que la fuente dice literalmente, sin reescribir."
            translator={translator}
          />
        )}

        {active === 'claims' && <ClaimList claims={claims} />}

        {active === 'record' && <Record item={item} />}
      </div>
    </div>
  );
}

/** One body of text with its optional translation underneath. The translation
 *  never replaces the original: ingestion keeps the source language on purpose. */
function Passage({
  passageKey,
  text,
  note,
  translator,
}: {
  passageKey: string;
  text: string;
  note: string;
  translator: ReturnType<typeof useTranslator>;
}) {
  const translated = translator.get(passageKey);
  const busy = translator.pendingKey === passageKey;

  return (
    <div className="animate-fade">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-rule pb-2.5">
        <p className="u-label normal-case tracking-normal">{note}</p>
        <div className="flex items-center gap-1.5">
          <select
            value={translator.target}
            onChange={(e) => translator.setTarget(e.target.value)}
            aria-label="Idioma de la traducción"
            className="h-6.5 rounded-sm border border-rule bg-transparent px-1.5 text-xs text-muted focus:outline-none"
          >
            {TRANSLATION_TARGETS.map((language) => (
              <option key={language} value={language}>
                {language}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => translator.translate(passageKey, text)}
            disabled={translator.pendingKey !== null || Boolean(translated)}
            className="btn btn-sm"
          >
            <Languages size={12} aria-hidden="true" />
            {busy ? 'Traduciendo…' : translated ? 'Traducido' : 'Traducir'}
          </button>
        </div>
      </div>

      <div className="u-prose whitespace-pre-wrap">{text}</div>

      {translator.error && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-bad">
          <TriangleAlert size={12} aria-hidden="true" />
          {translator.error}
        </p>
      )}

      {translated && (
        <div className="mt-6 border-t border-accent-line pt-4">
          <p className="u-label mb-2 text-accent">Traducción · {translator.target}</p>
          <div className="u-prose whitespace-pre-wrap text-muted">{translated}</div>
        </div>
      )}
    </div>
  );
}

/** Everything about the item that is not its text: how far it got through the
 *  pipeline, what was captured, and how it is tagged. */
function Record({ item }: { item: CapturedItem }) {
  return (
    <div className="animate-fade flex flex-col gap-6">
      <section>
        <h3 className="u-label mb-3">Recorrido</h3>
        <PipelineDetail item={item} />
      </section>

      {item.tags && item.tags.length > 0 && (
        <section>
          <h3 className="u-label mb-2">Etiquetas</h3>
          <div className="flex flex-wrap gap-1.5">
            {item.tags.map((tag) => (
              <span key={tag} className="tag">
                #{tag}
              </span>
            ))}
          </div>
        </section>
      )}

      <section>
        <h3 className="u-label mb-2">Lo que se capturó</h3>
        <p className="well px-3 py-2.5 font-mono text-xs leading-relaxed break-all text-muted">
          {item.rawInput}
        </p>
      </section>

      {!item.content && (
        <p className="flex items-start gap-2 text-sm text-muted">
          <Ban size={14} className="mt-0.5 shrink-0 text-faint" aria-hidden="true" />
          No se guardó ningún texto para esta entrada. {item.issue ? excerpt(item.issue, 140) : ''}
        </p>
      )}

      <section className="flex flex-col gap-1.5 border-t border-rule pt-4 text-xs">
        <Row label="Capturado" value={absoluteTime(item.createdAt)} />
        <Row label="Estado interno" value={item.status} mono />
        <Row label="Identificador" value={item.id} mono />
      </section>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="shrink-0 text-faint">{label}</span>
      <span className={`min-w-0 truncate text-right text-muted ${mono ? 'font-mono text-2xs' : ''}`}>
        {value}
      </span>
    </div>
  );
}
