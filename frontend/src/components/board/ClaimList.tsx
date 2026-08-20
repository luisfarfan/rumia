import { ArrowUpRight, Check, CircleHelp, X } from 'lucide-react';
import type { ClaimVerification } from '@/lib/types';
import { hostOf } from '@/lib/format';

const VERDICT = {
  True: { label: 'Cierto', tone: 'tag-accent', Icon: Check },
  False: { label: 'Falso', tone: 'tag-bad', Icon: X },
  Inconclusive: { label: 'Sin concluir', tone: 'tag-warn', Icon: CircleHelp },
} as const;

/** Verdicts never ride on colour alone: each one carries a word and a glyph. */
export function ClaimList({ claims }: { claims: ClaimVerification[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {claims.map((claim) => {
        const verdict = VERDICT[claim.status] ?? VERDICT.Inconclusive;
        const { Icon } = verdict;

        return (
          <li key={claim.id} className="panel p-4">
            <div className="mb-2 flex items-start justify-between gap-3">
              <p className="font-serif text-base leading-snug text-ink italic">«{claim.claim}»</p>
              <span className={`tag ${verdict.tone} shrink-0`}>
                <Icon size={11} strokeWidth={2.5} aria-hidden="true" />
                {verdict.label}
              </span>
            </div>

            <p className="text-sm leading-relaxed text-muted">{claim.explanation}</p>

            {claim.sources?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5 border-t border-rule pt-2.5">
                {claim.sources.map((source, i) => (
                  <a
                    key={source.url ?? i}
                    href={source.url ?? '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="tag max-w-full transition-colors hover:border-accent-line hover:bg-accent-soft hover:text-accent"
                  >
                    <span className="truncate">{source.title || hostOf(source.url) || 'Fuente'}</span>
                    <ArrowUpRight size={10} className="shrink-0" aria-hidden="true" />
                  </a>
                ))}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
