import { execFileSync } from 'child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as dotenv from 'dotenv';

import { pool } from '../src/db/index.js';

dotenv.config();

/**
 * The stored vector dimension must match what the embedding model actually
 * produces. The schema was written for `text-embedding-3-small` (1536) while the
 * configured model, `bge-m3`, emits 1024 — every insert would be rejected at
 * runtime, inside a worker, long after the change looked done.
 *
 * These tests run the real migration and then interrogate the live database,
 * rather than reading `schema.sql`: the file saying 1024 proves nothing about the
 * table that exists. Requires Postgres up (`docker compose up -d`).
 */

const DIMENSION_ESPERADA = 1024;
const ITEM_DE_PRUEBA = '00000000-0000-4000-8000-00000000d1de';

/** pgvector encodes its dimension in `atttypmod` on the column. */
async function dimensionDe(tabla: string, columna: string): Promise<number> {
  const { rows } = await pool.query<{ atttypmod: number }>(
    `SELECT a.atttypmod
       FROM pg_attribute a
       JOIN pg_class c ON c.oid = a.attrelid
      WHERE c.relname = $1 AND a.attname = $2 AND a.attnum > 0`,
    [tabla, columna]
  );
  expect(rows.length, `no existe ${tabla}.${columna}`).toBe(1);
  return rows[0]!.atttypmod;
}

beforeAll(() => {
  execFileSync('npm', ['run', 'migrate'], { stdio: 'pipe' });
});

afterAll(async () => {
  await pool.query('DELETE FROM item_chunks WHERE item_id = $1', [ITEM_DE_PRUEBA]).catch(() => {});
  await pool.query('DELETE FROM captured_items WHERE id = $1', [ITEM_DE_PRUEBA]).catch(() => {});
  await pool.end();
});

describe('dimensión vectorial del esquema migrado', () => {
  it(`item_chunks.embedding es vector(${DIMENSION_ESPERADA})`, async () => {
    expect(await dimensionDe('item_chunks', 'embedding')).toBe(DIMENSION_ESPERADA);
  });

  it(`nodes.embedding es vector(${DIMENSION_ESPERADA})`, async () => {
    expect(await dimensionDe('nodes', 'embedding')).toBe(DIMENSION_ESPERADA);
  });

  it('un vector de 1024 posiciones se guarda y se lee con la misma longitud', async () => {
    await pool.query(
      `INSERT INTO captured_items (id, user_id, raw_input, source_channel, status)
       VALUES ($1, 'test', 'fixture', 'telegram', 'extracted')
       ON CONFLICT (id) DO NOTHING`,
      [ITEM_DE_PRUEBA]
    );

    const vector = Array.from({ length: DIMENSION_ESPERADA }, (_, i) => i / DIMENSION_ESPERADA);
    await pool.query(
      `INSERT INTO item_chunks (item_id, chunk_index, content, embedding)
       VALUES ($1, 0, 'contenido de prueba', $2)
       ON CONFLICT (item_id, chunk_index) DO UPDATE SET embedding = EXCLUDED.embedding`,
      [ITEM_DE_PRUEBA, `[${vector.join(',')}]`]
    );

    const { rows } = await pool.query<{ dims: number }>(
      'SELECT vector_dims(embedding) AS dims FROM item_chunks WHERE item_id = $1',
      [ITEM_DE_PRUEBA]
    );

    expect(rows[0]!.dims).toBe(DIMENSION_ESPERADA);
  });

  it('la base rechaza un vector de otra dimensión, así que la restricción es real', async () => {
    const equivocado = Array.from({ length: 1536 }, () => 0.1);

    await expect(
      pool.query(
        `INSERT INTO item_chunks (item_id, chunk_index, content, embedding)
         VALUES ($1, 99, 'dimension equivocada', $2)`,
        [ITEM_DE_PRUEBA, `[${equivocado.join(',')}]`]
      )
    ).rejects.toThrow(/expected 1024 dimensions|different vector dimensions/i);
  });
});
