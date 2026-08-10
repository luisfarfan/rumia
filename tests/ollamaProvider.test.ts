import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';

import { LLMFactory } from '../src/core/llm/LLMFactory.js';
import { OllamaProvider } from '../src/core/llm/providers/OllamaProvider.js';
import { CodexProvider } from '../src/core/llm/providers/CodexProvider.js';
import { AntigravityProvider } from '../src/core/llm/providers/AntigravityProvider.js';

/**
 * The embedding backend must be honest about failure.
 *
 * cliproxyapi answers `/v1/embeddings` with 404 and the pipeline had no way to
 * notice: providers returned zero-filled vectors, so the chunks table would fill
 * with vectors whose every similarity score is identical. These tests pin that a
 * failure surfaces as a thrown error, and that results stay aligned with their
 * inputs — a misaligned batch stores each chunk against another chunk's meaning,
 * which no later test would catch.
 */

const BASE_URL = 'http://ollama-de-prueba:11434/v1';

function respondWith(body: unknown, ok = true, status = 200) {
  return vi.fn(async () => ({
    ok,
    status,
    statusText: ok ? 'OK' : 'Not Found',
    json: async () => body,
    text: async () => JSON.stringify(body),
  })) as unknown as typeof fetch;
}

beforeEach(() => {
  vi.stubEnv('OLLAMA_BASE_URL', BASE_URL);
  vi.stubEnv('OLLAMA_EMBEDDING_MODEL', 'bge-m3');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('OllamaProvider', () => {
  it('el factory lo devuelve cuando EMBEDDING_LLM_PROVIDER=ollama', async () => {
    vi.stubEnv('EMBEDDING_LLM_PROVIDER', 'ollama');
    // The factory memoizes its instance, so ask for a fresh module registry — and
    // take the class from that same registry, since a reset mints a new class
    // object and `instanceof` compares identity, not shape.
    vi.resetModules();
    const [{ LLMFactory: Fresh }, { OllamaProvider: FreshOllama }] = await Promise.all([
      import('../src/core/llm/LLMFactory.js'),
      import('../src/core/llm/providers/OllamaProvider.js'),
    ]);

    expect(Fresh.getEmbeddingProvider()).toBeInstanceOf(FreshOllama);
  });

  it('hace POST a {OLLAMA_BASE_URL}/embeddings con el modelo configurado', async () => {
    const fakeFetch = respondWith({
      model: 'bge-m3',
      data: [{ index: 0, embedding: [0.1, 0.2] }],
    });
    vi.stubGlobal('fetch', fakeFetch);

    await new OllamaProvider().generateEmbeddings(['hola']);

    const [url, init] = (fakeFetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(url).toBe(`${BASE_URL}/embeddings`);
    expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({
      model: 'bge-m3',
      input: ['hola'],
    });
  });

  it('devuelve un vector por texto, en el orden de los textos', async () => {
    // Returned deliberately out of order, carrying their own index.
    vi.stubGlobal(
      'fetch',
      respondWith({
        data: [
          { index: 2, embedding: [3] },
          { index: 0, embedding: [1] },
          { index: 1, embedding: [2] },
        ],
      })
    );

    const vectors = await new OllamaProvider().generateEmbeddings(['a', 'b', 'c']);

    expect(vectors).toEqual([[1], [2], [3]]);
  });

  it('propaga el error HTTP en vez de devolver vectores vacíos o de ceros', async () => {
    vi.stubGlobal('fetch', respondWith({ error: 'not found' }, false, 404));

    await expect(new OllamaProvider().generateEmbeddings(['hola'])).rejects.toThrow(/404/);
  });

  it('rechaza una respuesta con menos vectores que textos', async () => {
    vi.stubGlobal('fetch', respondWith({ data: [{ index: 0, embedding: [1] }] }));

    await expect(new OllamaProvider().generateEmbeddings(['a', 'b'])).rejects.toThrow(
      /1 embeddings for 2 inputs/
    );
  });

  it('sus métodos de chat lanzan en vez de devolver texto simulado', async () => {
    const provider = new OllamaProvider();

    await expect(provider.generateCompletion()).rejects.toThrow(/embeddings only/);
    await expect(provider.generateStructured()).rejects.toThrow(/embeddings only/);
  });

  it('exige su configuración al construirse', () => {
    vi.stubEnv('OLLAMA_EMBEDDING_MODEL', '');

    expect(() => new OllamaProvider()).toThrowError(/OLLAMA_EMBEDDING_MODEL/);
  });
});

describe('proveedores stub', () => {
  it('CodexProvider y AntigravityProvider ya no devuelven vectores de ceros', async () => {
    await expect(new CodexProvider().generateEmbeddings()).rejects.toThrow(/not implemented/i);
    await expect(new AntigravityProvider().generateEmbeddings()).rejects.toThrow(/not implemented/i);
  });
});

describe('documentación de configuración', () => {
  it('.env.example documenta OLLAMA_BASE_URL y OLLAMA_EMBEDDING_MODEL', () => {
    const ejemplo = fs.readFileSync('.env.example', 'utf8');

    expect(ejemplo).toMatch(/^OLLAMA_BASE_URL=/m);
    expect(ejemplo).toMatch(/^OLLAMA_EMBEDDING_MODEL=/m);
  });
});

// Keeps the unused-import checker honest: LLMFactory is exercised via the fresh
// module registry above, not the top-level binding.
void LLMFactory;
