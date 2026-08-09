import { execSync } from 'node:child_process';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { webExtractionHandler } from '../src/workers/ingestion/handlers/webExtractionHandler.js';

/**
 * Readability returning null used to fall through to a literal placeholder
 * string, `'No readable text extracted.'`, saved as if it were real content.
 * The item then looked ingested, got categorized and vectorized off of a
 * marker string instead of any actual page text.
 *
 * These tests pin the corrected contract: no article and no meta description
 * throws (the item fails loudly instead of looking ingested); a meta
 * description with no article is still usable as content; a real article is
 * returned unchanged.
 */

function respondWithHtml(html: string) {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    text: async () => html,
  })) as unknown as typeof fetch;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('webExtractionHandler', () => {
  it('lanza cuando la página no da ni artículo legible ni meta description', async () => {
    vi.stubGlobal(
      'fetch',
      respondWithHtml(`<html><head><title>Vacía</title></head><body></body></html>`)
    );

    await expect(webExtractionHandler('https://example.com/vacia')).rejects.toThrow();

    vi.unstubAllGlobals();
  });

  it('el literal "No readable text extracted." ya no aparece en el fuente de src/', () => {
    const matches = execSync(
      `grep -rl "No readable text extracted" src/ || true`,
      { cwd: process.cwd(), encoding: 'utf-8' }
    ).trim();

    expect(matches).toBe('');
  });

  it('cuando hay meta description pero no artículo legible, esa description se devuelve como contenido', async () => {
    vi.stubGlobal(
      'fetch',
      respondWithHtml(
        `<html><head><title>Vacía</title><meta name="description" content="Una descripción corta de la página."></head><body></body></html>`
      )
    );

    const result = await webExtractionHandler('https://example.com/solo-descripcion');

    expect(result.description).toBe('Una descripción corta de la página.');
    expect(result.content).toBe('Una descripción corta de la página.');

    vi.unstubAllGlobals();
  });

  it('lanza cuando Readability encuentra un <article> pero sin texto y no hay meta description', async () => {
    vi.stubGlobal(
      'fetch',
      respondWithHtml(
        `<html><head><title>Artículo vacío</title></head><body><article><div class="ads"></div></article></body></html>`
      )
    );

    await expect(webExtractionHandler('https://example.com/articulo-vacio')).rejects.toThrow();

    vi.unstubAllGlobals();
  });

  it('cuando el <article> no tiene texto pero sí hay meta description, esa description se devuelve como contenido', async () => {
    vi.stubGlobal(
      'fetch',
      respondWithHtml(
        `<html><head><title>Artículo vacío</title><meta name="description" content="Una descripción corta de la página."></head><body><article><div class="ads"></div></article></body></html>`
      )
    );

    const result = await webExtractionHandler('https://example.com/articulo-vacio-con-descripcion');

    expect(result.description).toBe('Una descripción corta de la página.');
    expect(result.content).toBe('Una descripción corta de la página.');

    vi.unstubAllGlobals();
  });

  it('un artículo legible se sigue devolviendo íntegro', async () => {
    const longPara = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(20);
    vi.stubGlobal(
      'fetch',
      respondWithHtml(
        `<html><head><title>Artículo real</title><meta name="description" content="resumen"></head><body><article><h1>Artículo real</h1><p>${longPara}</p><p>${longPara}</p><p>${longPara}</p></article></body></html>`
      )
    );

    const result = await webExtractionHandler('https://example.com/articulo');

    expect(result.content.length).toBeGreaterThan(1000);
    expect(result.content).toContain('Lorem ipsum');

    vi.unstubAllGlobals();
  });
});
