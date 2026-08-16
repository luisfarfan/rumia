import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it, vi } from 'vitest';

import { dispatchIngestion, type IngestionHandlers } from '../src/workers/ingestion/dispatchIngestion.js';

/**
 * The item-to-handler routing used to live inline inside the BullMQ Worker closure,
 * with an explicit exclusion list that dropped github/x/linkedin into the unhandled
 * branch even though they had a URL to extract. These tests exercise the extracted
 * `dispatchIngestion` function directly — no queue, no Redis, no real network or
 * filesystem calls, only fake handlers — to pin the routing table itself.
 */

function fakeHandlers(overrides: Partial<IngestionHandlers> = {}): IngestionHandlers {
  return {
    webExtractionHandler: vi.fn(async () => ({ title: 'web title', description: 'web desc', content: 'web content', thumbnailUrl: null })),
    audioTranscriptionHandler: vi.fn(async () => ({ content: 'audio content' })),
    socialMediaHandler: vi.fn(async () => ({ title: 'social title', content: 'social content', visualAnalysisFailed: false, transcriptionFailed: false, thumbnailUrl: 'https://cdn/poster.jpg' })),
    photoHandler: vi.fn(async () => ({ title: 'photo title', content: 'photo content' })),
    tiktokCarouselHandler: vi.fn(async () => ({ title: 'carousel title', content: 'carousel content', thumbnailUrl: 'https://cdn/slide0.webp' })),
    socialPostHandler: vi.fn(async () => ({ title: 'meta title', content: 'meta content', visualAnalysisFailed: false, thumbnailUrl: 'https://cdn/preview.jpg' })),
    ...overrides,
  };
}

/** yt-dlp reports a photo carousel as an unsupported URL, and puts the reason on
 *  `stderr` rather than `message` — mirrored here so the fixture cannot pass by
 *  matching a shape the real tool never produces. */
function unsupportedUrlError(): Error & { stderr: string } {
  return Object.assign(new Error('Command failed with exit code 1'), {
    stderr: 'ERROR: Unsupported URL: https://www.tiktok.com/@x/photo/1',
  });
}

describe('dispatchIngestion', () => {
  it('la sola importación no depende de TELEGRAM_BOT_TOKEN ni de Redis: sobrevive en un proceso hijo con env vacío y sin .env', () => {
    // Real isolation check: importing dispatchIngestion.js must not transitively
    // load a module with a load-time side effect that needs these vars (e.g. the
    // Telegram bot client calling process.exit(1) without a token). A child
    // process with a scrubbed env and a cwd with no .env file is the only way to
    // catch that — asserting on the live process's env would just reflect
    // whatever happens to be in the developer's .env.
    const tsxBin = path.resolve(process.cwd(), 'node_modules/.bin/tsx');
    const fixture = path.resolve(process.cwd(), 'tests/fixtures/importDispatchIngestion.ts');

    const scrubbedEnv: NodeJS.ProcessEnv = { ...process.env };
    delete scrubbedEnv.TELEGRAM_BOT_TOKEN;
    delete scrubbedEnv.REDIS_URL;
    delete scrubbedEnv.REDIS_HOST;

    // An isolated cwd with no .env guarantees dotenv.config() (called deep in
    // the bot module) cannot silently repopulate the vars we just deleted.
    const isolatedCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'dispatch-isolation-'));

    try {
      const result = spawnSync(tsxBin, [fixture], {
        cwd: isolatedCwd,
        env: scrubbedEnv,
        encoding: 'utf-8',
        timeout: 30_000,
      });

      expect(result.status, `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`).toBe(0);
    } finally {
      fs.rmSync(isolatedCwd, { recursive: true, force: true });
    }
  });

  it.each(['github', 'linkedin', 'medium'])(
    'un ítem %s con URL se enruta a extracción web',
    async (detectedSource) => {
      const handlers = fakeHandlers();

      const result = await dispatchIngestion(
        { detectedSource, originalUrl: 'https://example.com/thing', rawInput: 'raw' },
        'item-1',
        { handlers }
      );

      expect(handlers.webExtractionHandler).toHaveBeenCalledWith('https://example.com/thing');
      expect(result).toEqual({
        handled: true,
        title: 'web title',
        content: 'web content',
        description: 'web desc',
        thumbnailUrl: null,
        degradedReason: null,
      });
    }
  );

  it('youtube conserva el handler de social media', async () => {
    const handlers = fakeHandlers();

    const result = await dispatchIngestion(
      { detectedSource: 'youtube', originalUrl: 'https://youtube.com/watch?v=1', rawInput: 'raw' },
      'item-2',
      { handlers }
    );

    expect(handlers.socialMediaHandler).toHaveBeenCalledWith('https://youtube.com/watch?v=1', 'item-2');
    expect(handlers.webExtractionHandler).not.toHaveBeenCalled();
    expect(result.handled).toBe(true);
    expect(result.content).toBe('social content');
  });

  it('tiktok conserva el handler de social media', async () => {
    const handlers = fakeHandlers();

    const result = await dispatchIngestion(
      { detectedSource: 'tiktok', originalUrl: 'https://tiktok.com/@x/video/1', rawInput: 'raw' },
      'item-3',
      { handlers }
    );

    expect(handlers.socialMediaHandler).toHaveBeenCalled();
    expect(result.handled).toBe(true);
  });

  it('photo se enruta a su propio handler, con el caption como contexto', async () => {
    const handlers = fakeHandlers();

    const result = await dispatchIngestion(
      { detectedSource: 'photo', fileId: 'file-1', rawInput: 'diagrama de arquitectura' },
      'item-4',
      { handlers }
    );

    expect(handlers.photoHandler).toHaveBeenCalledWith('file-1', {
      caption: 'diagrama de arquitectura',
      itemId: 'item-4',
    });
    expect(result.handled).toBe(true);
    expect(result.content).toBe('photo content');
  });

  it('una foto cuyo caption trae un enlace sigue yendo a photo, no a extracción web', async () => {
    // La imagen ES el contenido: un enlace que caiga en el caption no debe desviar
    // el ítem a raspar una página. `telegramCaptureService` extrae URLs del caption,
    // así que este caso es alcanzable en producción.
    const handlers = fakeHandlers();

    await dispatchIngestion(
      {
        detectedSource: 'photo',
        fileId: 'file-1',
        originalUrl: 'https://example.com/en-el-caption',
        rawInput: 'mira https://example.com/en-el-caption',
      },
      'item-4b',
      { handlers }
    );

    expect(handlers.photoHandler).toHaveBeenCalled();
    expect(handlers.webExtractionHandler).not.toHaveBeenCalled();
  });

  it('un carrusel de tiktok (yt-dlp lo rechaza) cae al handler de carrusel, no a extracción web', async () => {
    const handlers = fakeHandlers({
      socialMediaHandler: vi.fn(async () => {
        throw unsupportedUrlError();
      }),
    });

    const result = await dispatchIngestion(
      { detectedSource: 'tiktok', originalUrl: 'https://www.tiktok.com/@x/photo/1', rawInput: 'raw' },
      'item-4c',
      { handlers }
    );

    expect(handlers.tiktokCarouselHandler).toHaveBeenCalledWith('https://www.tiktok.com/@x/photo/1', 'item-4c');
    expect(handlers.webExtractionHandler).not.toHaveBeenCalled();
    expect(result.content).toBe('carousel content');
    expect(result.degradedReason).toBeNull();
  });

  it('si el carrusel también falla, cae a extracción web y queda marcado como degradado', async () => {
    const handlers = fakeHandlers({
      socialMediaHandler: vi.fn(async () => {
        throw unsupportedUrlError();
      }),
      tiktokCarouselHandler: vi.fn(async () => {
        throw new Error('rate limited');
      }),
    });

    const result = await dispatchIngestion(
      { detectedSource: 'tiktok', originalUrl: 'https://www.tiktok.com/@x/photo/1', rawInput: 'raw' },
      'item-4d',
      { handlers }
    );

    expect(handlers.webExtractionHandler).toHaveBeenCalled();
    expect(result.degradedReason).toMatch(/carousel unavailable/);
  });

  it('un fallo de social media que NO sea "Unsupported URL" se propaga sin intentar el carrusel', async () => {
    const boom = new Error('la red se cayó');
    const handlers = fakeHandlers({
      socialMediaHandler: vi.fn(async () => {
        throw boom;
      }),
    });

    await expect(
      dispatchIngestion(
        { detectedSource: 'tiktok', originalUrl: 'https://www.tiktok.com/@x/video/1', rawInput: 'raw' },
        'item-4e',
        { handlers }
      )
    ).rejects.toThrow(boom);
    expect(handlers.tiktokCarouselHandler).not.toHaveBeenCalled();
    expect(handlers.webExtractionHandler).not.toHaveBeenCalled();
  });

  it('cuando el análisis visual falla, el resultado queda marcado como degradado', async () => {
    const handlers = fakeHandlers({
      socialMediaHandler: vi.fn(async () => ({
        title: 'social title',
        content: 'solo transcripción',
        visualAnalysisFailed: true,
        transcriptionFailed: false,
        thumbnailUrl: null,
      })),
    });

    const result = await dispatchIngestion(
      { detectedSource: 'youtube', originalUrl: 'https://youtube.com/watch?v=1', rawInput: 'raw' },
      'item-4f',
      { handlers }
    );

    expect(result.degradedReason).toMatch(/visual analysis unavailable/);
    expect(result.content).toBe('solo transcripción');
  });

  it.each(['audio', 'voice'])('%s conserva el audio transcription handler', async (detectedSource) => {
    const handlers = fakeHandlers();

    const result = await dispatchIngestion(
      { detectedSource, fileId: 'file-2', fileSize: 1024, rawInput: 'raw' },
      'item-5',
      { handlers }
    );

    expect(handlers.audioTranscriptionHandler).toHaveBeenCalledWith('file-2', 1024);
    expect(result.handled).toBe(true);
    expect(result.content).toBe('audio content');
  });

  it.each(['instagram', 'facebook', 'threads', 'bluesky', 'x', 'pinterest', 'mastodon'])(
    'un ítem %s se enruta al handler de posts por Open Graph',
    async (detectedSource) => {
      const handlers = fakeHandlers();

      const result = await dispatchIngestion(
        { detectedSource, originalUrl: 'https://www.instagram.com/p/ABC/', rawInput: 'raw' },
        'item-meta',
        { handlers }
      );

      expect(handlers.socialPostHandler).toHaveBeenCalledWith('https://www.instagram.com/p/ABC/', 'item-meta');
      expect(handlers.webExtractionHandler).not.toHaveBeenCalled();
      expect(result.content).toBe('meta content');
      expect(result.thumbnailUrl).toBe('https://cdn/preview.jpg');
    }
  );

  it('un post de Meta con la imagen ilegible queda marcado como degradado', async () => {
    const handlers = fakeHandlers({
      socialPostHandler: vi.fn(async () => ({ title: 't', content: 'solo caption', visualAnalysisFailed: true, thumbnailUrl: null })),
    });

    const result = await dispatchIngestion(
      { detectedSource: 'instagram', originalUrl: 'https://www.instagram.com/p/ABC/', rawInput: 'raw' },
      'item-meta-2',
      { handlers }
    );

    expect(result.degradedReason).toMatch(/image unreadable/);
  });

  it.each(['reddit', 'pdf'])(
    'un ítem sin handler aplicable (%s, fuera de alcance) cae en la rama no manejada sin inventar contenido',
    async (detectedSource) => {
      const handlers = fakeHandlers();

      const result = await dispatchIngestion(
        { detectedSource, originalUrl: 'https://example.com/x', rawInput: 'texto crudo original' },
        'item-6',
        { handlers }
      );

      expect(result.handled).toBe(false);
      expect(result.content).toBe('texto crudo original');
      expect(result.degradedReason).toMatch(/no reader for source/);
      expect(handlers.webExtractionHandler).not.toHaveBeenCalled();
      expect(handlers.socialMediaHandler).not.toHaveBeenCalled();
      expect(handlers.audioTranscriptionHandler).not.toHaveBeenCalled();
    }
  );

  it('la lista de tipos de fuente no reaparece en worker.ts: la condición vive en un solo sitio', () => {
    // Guard simétrico al de tests/webExtractionFailure.test.ts. Hoy es cierto por
    // construcción, pero nada impedía que la condición volviera a duplicarse.
    const workerSource = fs.readFileSync('src/workers/ingestion/worker.ts', 'utf8');

    for (const sourceType of ['youtube', 'tiktok', 'linkedin', 'instagram', 'voice']) {
      expect(workerSource, `worker.ts volvió a mencionar "${sourceType}"`).not.toContain(
        `'${sourceType}'`
      );
    }
  });

  it('un tipo desconocido sin handler cae en la rama no manejada', async () => {
    const handlers = fakeHandlers();

    const result = await dispatchIngestion(
      { detectedSource: 'carrier-pigeon', rawInput: 'texto crudo' },
      'item-7',
      { handlers }
    );

    expect(result.handled).toBe(false);
    expect(result.content).toBe('texto crudo');
  });

  it('un tipo desconocido con URL sí cae en extracción web (comportamiento previo preservado)', async () => {
    const handlers = fakeHandlers();

    const result = await dispatchIngestion(
      { detectedSource: 'carrier-pigeon', originalUrl: 'https://example.com/y', rawInput: 'raw' },
      'item-8',
      { handlers }
    );

    expect(handlers.webExtractionHandler).toHaveBeenCalledWith('https://example.com/y');
    expect(result.handled).toBe(true);
  });

  it('cuando el handler seleccionado lanza, dispatchIngestion propaga el error en vez de convertirlo en contenido', async () => {
    const boom = new Error('la página no respondió');
    const handlers = fakeHandlers({
      webExtractionHandler: vi.fn(async () => {
        throw boom;
      }),
    });

    await expect(
      dispatchIngestion(
        { detectedSource: 'github', originalUrl: 'https://github.com/foo/bar', rawInput: 'raw' },
        'item-9',
        { handlers }
      )
    ).rejects.toThrow(boom);
  });

  it('notifica el cambio de estado antes de invocar el handler correspondiente', async () => {
    const handlers = fakeHandlers();
    const statuses: string[] = [];

    await dispatchIngestion(
      { detectedSource: 'x', originalUrl: 'https://x.com/foo/status/1', rawInput: 'raw' },
      'item-10',
      { handlers, onStatusChange: async (status) => { statuses.push(status); } }
    );

    expect(statuses).toEqual(['extracting']);
  });
});
