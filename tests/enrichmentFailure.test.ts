import * as fs from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * A late stage failing must not erase a successful ingestion.
 *
 * The embedding and graph workers used to set `status: 'error'` on terminal
 * failure, which turned a fully ingested item — content, title, category, all
 * stored — into a red "Failed" card. Observed for real: a transient 503 from the
 * model provider during graph extraction marked three items with 3–4k characters
 * of good content as failed.
 *
 * A source-level guard, because reproducing it needs Redis, Postgres, three
 * workers and a provider outage, and the defect is one line in each file.
 */

const ENRICHMENT_WORKERS = [
  'src/workers/embedding/worker.ts',
  'src/workers/graph/worker.ts',
];

describe('un fallo de enriquecimiento no borra la ingesta', () => {
  it.each(ENRICHMENT_WORKERS)('%s solo marca error si el ítem no tiene contenido', (workerPath) => {
    const source = fs.readFileSync(workerPath, 'utf8');

    // El estado de error queda condicionado a que no haya contenido, en vez de
    // escribirse siempre que la etapa falle.
    expect(source, `${workerPath} vuelve a marcar error incondicionalmente`).toMatch(
      /hasContent \? \{\} : \{ status: 'error'/
    );
    expect(source).toMatch(/const hasContent = Boolean\(item\?\.content\?\.trim\(\)\)/);
  });

  it('el worker de ingesta sí puede fallar el ítem: ahí no hay nada que conservar', () => {
    // Control positivo: si la ingesta misma falla no hay contenido, y marcar
    // error es lo correcto. Sin esto, los guards de arriba podrían pasar en un
    // sistema que nunca marca error en ningún sitio.
    const source = fs.readFileSync('src/workers/ingestion/worker.ts', 'utf8');
    expect(source).toMatch(/status: 'error'/);
  });
});
