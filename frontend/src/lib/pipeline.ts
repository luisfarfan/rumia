import type { CapturedItem } from './types';

/**
 * The database stores one opaque string per item — `extracting`,
 * `chunked_and_embedded`, `graph_extracted` — which tells the reader nothing
 * about how far the item actually got. Ingestion is four phases, so the board
 * shows four segments and the string only decides how many are filled.
 */
export type StageKey = 'capture' | 'read' | 'index' | 'link';
export type StageState = 'done' | 'active' | 'pending' | 'failed';

export interface Stage {
  key: StageKey;
  /** Segment label, used in the tooltip and the reader's track. */
  name: string;
  /** What this phase actually produced, for the tooltip's second line. */
  detail: string;
  state: StageState;
}

const STAGES: Array<{ key: StageKey; name: string; detail: string }> = [
  { key: 'capture', name: 'Capturado', detail: 'El enlace llegó y quedó guardado.' },
  { key: 'read', name: 'Leído', detail: 'Transcripción, lectura visual o texto del artículo.' },
  { key: 'index', name: 'Indexado', detail: 'Troceado en fragmentos y convertido en vectores.' },
  { key: 'link', name: 'Conectado', detail: 'Entidades y relaciones extraídas al grafo.' },
];

/** How many phases the status string proves were finished. */
const REACHED: Record<string, number> = {
  received: 1,
  extracting: 1,
  extracted: 2,
  chunking: 2,
  embedding: 2,
  chunked_and_embedded: 3,
  indexing: 3,
  graph_extracted: 4,
};

export const isFailed = (status: string) => status === 'error' || status === 'failed';

export function stagesOf(item: Pick<CapturedItem, 'status'>): Stage[] {
  const failed = isFailed(item.status);
  // A failed item stops wherever it stopped; the status no longer records how
  // far it got, so the first segment is the only one we can honestly fill.
  const reached = failed ? 1 : (REACHED[item.status] ?? 1);

  return STAGES.map((stage, i) => {
    let state: StageState;
    if (i < reached) state = 'done';
    else if (failed) state = i === reached ? 'failed' : 'pending';
    else if (i === reached) state = 'active';
    else state = 'pending';
    return { ...stage, state };
  });
}

export type Health = 'complete' | 'running' | 'partial' | 'failed';

export function healthOf(item: Pick<CapturedItem, 'status' | 'issue'>): Health {
  if (isFailed(item.status)) return 'failed';
  // A degraded item must never look identical to a whole one, even once the
  // remaining phases finish on top of the gap.
  if (item.issue) return 'partial';
  return item.status === 'graph_extracted' ? 'complete' : 'running';
}

export const HEALTH_LABEL: Record<Health, string> = {
  complete: 'Completo',
  running: 'Procesando',
  partial: 'Incompleto',
  failed: 'Falló',
};
