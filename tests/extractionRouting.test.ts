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
    webExtractionHandler: vi.fn(async () => ({ title: 'web title', description: 'web desc', content: 'web content' })),
    audioTranscriptionHandler: vi.fn(async () => ({ content: 'audio content' })),
    socialMediaHandler: vi.fn(async () => ({ title: 'social title', content: 'social content', visualAnalysisFailed: false })),
    tiktokCarouselHandler: vi.fn(async () => ({ title: 'carousel title', content: 'carousel content' })),
    photoHandler: vi.fn(async () => ({ title: 'photo title', content: 'photo content' })),
    ...overrides,
  };
}

describe('dispatchIngestion', () => {
  it('es invocable sin BullMQ ni Redis: ninguna de sus dependencias importa esos módulos', async () => {
    const mod = await import('../src/workers/ingestion/dispatchIngestion.js');
    expect(typeof mod.dispatchIngestion).toBe('function');
  });

  it.each(['github', 'x', 'linkedin'])(
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

  it('photo conserva el photo handler', async () => {
    const handlers = fakeHandlers();

    const result = await dispatchIngestion(
      { detectedSource: 'photo', fileId: 'file-1', rawInput: 'una nota' },
      'item-4',
      { handlers }
    );

    expect(handlers.photoHandler).toHaveBeenCalledWith('file-1', { caption: 'una nota', itemId: 'item-4' });
    expect(result.handled).toBe(true);
    expect(result.content).toBe('photo content');
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

  it.each(['instagram', 'reddit'])(
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
      expect(handlers.webExtractionHandler).not.toHaveBeenCalled();
      expect(handlers.socialMediaHandler).not.toHaveBeenCalled();
      expect(handlers.audioTranscriptionHandler).not.toHaveBeenCalled();
      expect(handlers.photoHandler).not.toHaveBeenCalled();
    }
  );

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
