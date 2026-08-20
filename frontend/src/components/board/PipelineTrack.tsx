import type { CapturedItem } from '@/lib/types';
import { HEALTH_LABEL, healthOf, stagesOf, type Stage, type StageState } from '@/lib/pipeline';

const SEGMENT: Record<StageState, string> = {
  done: 'bg-accent',
  active: 'bg-accent/45 animate-pulse',
  failed: 'bg-bad',
  pending: 'bg-rule-strong',
};

const DOT: Record<StageState, string> = {
  done: 'bg-accent border-accent',
  active: 'bg-accent/35 border-accent animate-pulse',
  failed: 'bg-bad border-bad',
  pending: 'bg-transparent border-rule-strong',
};

const summarize = (item: Pick<CapturedItem, 'status' | 'issue'>, stages: Stage[]) => {
  const done = stages.filter((s) => s.state === 'done').length;
  return `${HEALTH_LABEL[healthOf(item)]} · ${done} de ${stages.length} fases`;
};

/**
 * Four segments, one per ingestion phase. The raw status column says
 * `chunked_and_embedded` and expects the reader to know what that implies;
 * this says how far the item got and what is still missing.
 */
export function PipelineTrack({ item }: { item: Pick<CapturedItem, 'status' | 'issue'> }) {
  const stages = stagesOf(item);
  const label = summarize(item, stages);

  return (
    <span className="inline-flex items-center gap-[3px]" title={label} aria-label={label} role="img">
      {stages.map((stage) => (
        <span
          key={stage.key}
          className={`h-[3px] w-3.5 rounded-full transition-colors duration-200 ${SEGMENT[stage.state]}`}
        />
      ))}
    </span>
  );
}

/** The same model, opened out: used once per reader, where there is room to
 *  name each phase and say what it produced. */
export function PipelineDetail({ item }: { item: Pick<CapturedItem, 'status' | 'issue'> }) {
  const stages = stagesOf(item);

  return (
    <ol className="flex flex-col gap-0">
      {stages.map((stage, i) => (
        <li key={stage.key} className="relative flex gap-3 pb-3.5 last:pb-0">
          {i < stages.length - 1 && (
            <span
              aria-hidden="true"
              className={`absolute top-3 bottom-0 left-[5px] w-px ${
                stage.state === 'done' ? 'bg-accent/45' : 'bg-rule'
              }`}
            />
          )}
          <span
            aria-hidden="true"
            className={`relative z-10 mt-[5px] size-[11px] shrink-0 rounded-full border-2 ${DOT[stage.state]}`}
          />
          <div className="min-w-0 -mt-0.5">
            <p
              className={`text-sm font-medium ${
                stage.state === 'pending' ? 'text-faint' : stage.state === 'failed' ? 'text-bad' : 'text-ink'
              }`}
            >
              {stage.name}
              {stage.state === 'active' && <span className="ml-1.5 text-xs text-muted">en curso…</span>}
              {stage.state === 'failed' && <span className="ml-1.5 text-xs">se detuvo aquí</span>}
            </p>
            <p className="text-xs text-faint">{stage.detail}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
