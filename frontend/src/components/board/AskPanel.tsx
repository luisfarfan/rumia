'use client';

import { forwardRef } from 'react';
import { ArrowUpRight, CornerDownLeft, Sparkles, TriangleAlert, X } from 'lucide-react';
import type { AskState } from '@/hooks/useAsk';
import { hostOf, plural } from '@/lib/format';
import { Skeleton } from '@/components/ui/Skeleton';

/**
 * The board's filter narrows the rows already on screen. This searches meaning
 * across everything ingested and cites what it used, so it gets the room and
 * the reading typeface that a real answer deserves.
 */
export const AskPanel = forwardRef<HTMLInputElement, { state: AskState }>(function AskPanel(
  { state },
  ref,
) {
  const { question, setQuestion, answer, asked, pending, error, ask, clear } = state;
  const open = pending || Boolean(answer) || Boolean(error);

  return (
    <section className="well overflow-hidden" aria-label="Preguntar a la base de conocimiento">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <Sparkles size={16} className="shrink-0 text-accent" aria-hidden="true" />
        <input
          ref={ref}
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && ask()}
          placeholder="Pregúntale a todo lo que has guardado…"
          aria-label="Pregunta en lenguaje natural"
          className="min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-faint focus:outline-none"
        />
        {question.trim() && !pending && (
          <kbd className="hidden items-center gap-1 rounded-xs border border-rule px-1.5 py-0.5 font-mono text-2xs text-faint sm:inline-flex">
            <CornerDownLeft size={10} aria-hidden="true" />
          </kbd>
        )}
        <button
          type="button"
          onClick={ask}
          disabled={pending || !question.trim()}
          className="btn btn-primary btn-sm"
        >
          {pending ? 'Buscando…' : 'Preguntar'}
        </button>
        {open && (
          <button type="button" onClick={clear} className="btn btn-ghost btn-sm btn-icon" aria-label="Limpiar respuesta">
            <X size={14} aria-hidden="true" />
          </button>
        )}
      </div>

      {open && (
        <div className="animate-fade border-t border-rule bg-paper px-4 py-4">
          {asked && (
            <p className="u-label mb-3">
              {pending ? 'Buscando' : 'Preguntaste'} · {asked}
            </p>
          )}

          {pending && (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-3.5 w-[92%]" />
              <Skeleton className="h-3.5 w-[86%]" />
              <Skeleton className="h-3.5 w-[64%]" />
            </div>
          )}

          {error && (
            <p className="flex items-start gap-2 text-sm text-bad">
              <TriangleAlert size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
              {error}
            </p>
          )}

          {answer && (
            <>
              <div className="u-prose text-base leading-[1.7] whitespace-pre-wrap">{answer.answer}</div>
              {answer.sources.length > 0 && (
                <div className="mt-4 border-t border-rule pt-3">
                  <p className="u-label mb-2">
                    {answer.sources.length} {plural('fuente', answer.sources.length)}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {answer.sources.map((source, i) => (
                      <a
                        key={source.url ?? `${source.title}-${i}`}
                        href={source.url ?? '#'}
                        target="_blank"
                        rel="noreferrer"
                        className="tag max-w-[280px] transition-colors hover:border-accent-line hover:bg-accent-soft hover:text-accent"
                      >
                        <span className="truncate">{source.title || hostOf(source.url) || source.url}</span>
                        <ArrowUpRight size={10} className="shrink-0" aria-hidden="true" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
});
