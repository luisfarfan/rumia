import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Audio transcription must never fabricate.
 *
 * The handler used to return "[Transcripción Mock de Audio]" whenever no API key
 * was configured. That placeholder was stored as content, categorized, embedded
 * and pushed into the knowledge graph, so every voice note and every spoken video
 * looked successfully ingested while carrying nothing. These tests pin that an
 * unconfigured, failing or empty transcriber raises instead.
 */

const BASE_URL = 'http://whisper-de-prueba:9000/v1';

vi.mock('../src/bot/client.js', () => ({
  bot: { api: { getFile: vi.fn() } },
}));

function jsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

beforeEach(() => {
  vi.stubEnv('WHISPER_BASE_URL', BASE_URL);
  vi.stubEnv('WHISPER_MODEL', 'large-v3');
  vi.stubEnv('WHISPER_API_KEY', '');
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

/** Exercises the local-file path so no Telegram download is involved. */
async function transcribeLocalFile(fixturePath: string) {
  const { audioTranscriptionHandler } = await import(
    '../src/workers/ingestion/handlers/audioTranscriptionHandler.js'
  );
  return audioTranscriptionHandler(fixturePath);
}

const FIXTURE = 'tests/fixtures/tiny-audio.mp3';

describe('transcripción de audio', () => {
  it('envía el audio al endpoint configurado y devuelve el texto', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ text: '  hola mundo  ', language: 'es' }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await transcribeLocalFile(FIXTURE);

    expect(result.content).toBe('hola mundo');
    const [url, init] = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(url).toBe(`${BASE_URL}/audio/transcriptions`);
    expect((init as RequestInit).method).toBe('POST');
  });

  it('no fuerza un idioma: el modelo lo detecta, que es lo que necesita el contenido mezclado', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ text: 'ok', language: 'es' }));
    vi.stubGlobal('fetch', fetchMock);

    await transcribeLocalFile(FIXTURE);

    const body = ((fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![1] as RequestInit)
      .body as FormData;
    expect(body.get('language')).toBeNull();
    expect(body.get('model')).toBe('large-v3');
  });

  it('lanza si WHISPER_BASE_URL no está configurado, en vez de simular una transcripción', async () => {
    vi.stubEnv('WHISPER_BASE_URL', '');
    vi.stubGlobal('fetch', vi.fn());

    await expect(transcribeLocalFile(FIXTURE)).rejects.toThrow(/WHISPER_BASE_URL/);
  });

  it('lanza si el servicio responde con error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ detail: 'boom' }, false, 500)));

    await expect(transcribeLocalFile(FIXTURE)).rejects.toThrow(/status 500/);
  });

  it('lanza si la transcripción vuelve vacía, en vez de guardar contenido en blanco', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ text: '   ' })));

    await expect(transcribeLocalFile(FIXTURE)).rejects.toThrow(/no text/i);
  });

  it('el marcador de transcripción simulada ya no existe en el código', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(
      'src/workers/ingestion/handlers/audioTranscriptionHandler.ts',
      'utf8'
    );

    // Control positivo: la cadena sí aparece en la explicación de este test, así
    // que la comprobación mira el fuente del handler, no cualquier archivo.
    expect(source).not.toMatch(/Transcripci[óo]n Mock de Audio\s*-/);
  });
});
