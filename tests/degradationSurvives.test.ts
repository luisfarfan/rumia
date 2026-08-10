import * as fs from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The degradation reason must survive the rest of the pipeline.
 *
 * The ingestion worker writes it into `captured_items.error` (e.g. "audio
 * transcription unavailable"), and the embedding and graph workers then ran
 * `error: null` on success — silently erasing the only record that an item was
 * ingested with a piece of the pipeline missing. The item ended up looking
 * complete. This was found end-to-end, not by a unit test: the marking logic was
 * correct in isolation the whole time.
 *
 * A source-level guard, because reproducing it needs Postgres, Redis and three
 * workers, and the defect is one line in each.
 */

const LATER_STAGE_WORKERS = [
  'src/workers/embedding/worker.ts',
  'src/workers/graph/worker.ts',
];

describe('la marca de degradación sobrevive a las etapas posteriores', () => {
  it.each(LATER_STAGE_WORKERS)('%s no borra la columna error al tener éxito', (workerPath) => {
    const source = fs.readFileSync(workerPath, 'utf8');

    // The failure branches legitimately write an error message; only clearing it
    // to null on the success path is the defect.
    expect(source, `${workerPath} vuelve a limpiar la marca de degradación`).not.toMatch(
      /error:\s*null/
    );
  });

  it('el worker de ingesta sí escribe el motivo de degradación', () => {
    const source = fs.readFileSync('src/workers/ingestion/worker.ts', 'utf8');

    // Positive control: if this stops holding, the guard above is vacuous —
    // nothing would be writing the value the other two must preserve.
    expect(source).toMatch(/error:\s*dispatchResult\.degradedReason/);
  });
});
