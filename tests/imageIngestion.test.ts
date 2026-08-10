import * as fs from 'fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { imageMimeType } from '../src/utils/media/imageMime.js';

/**
 * OCR of social media: the images have to reach the vision tier, all of them, in
 * order, correctly labelled — and the temp files have to disappear afterwards.
 *
 * Verified against a real carousel before this was written: the vision tier
 * transcribes each slide literally, so the risk is not the model, it is the
 * plumbing around it. Every test here pins a piece of that plumbing.
 */

const visionCalls: { prompt: string; imagePaths: string[] }[] = [];

vi.mock('../src/core/llm/LLMFactory.js', () => ({
  LLMFactory: {
    getChatProvider: () => ({
      generateCompletion: async (prompt: string, options?: { imagePaths?: string[] }) => {
        visionCalls.push({ prompt, imagePaths: options?.imagePaths ?? [] });
        return 'GLASSMORFISMO — transparencia y blur.';
      },
    }),
  },
}));

const downloadTelegramFile = vi.fn();
vi.mock('../src/utils/media/telegramFile.js', () => ({
  downloadTelegramFile: (...args: unknown[]) => downloadTelegramFile(...args),
}));

const downloader = vi.fn();
vi.mock('@tobyg74/tiktok-api-dl', () => ({
  default: { Downloader: (...args: unknown[]) => downloader(...args) },
}));

function carouselResponse(images: string[], desc = 'Si estás creando un app o web') {
  return {
    status: 'success',
    result: { type: 'image', desc, images, author: { uniqueId: 'sebas.soto222' } },
  };
}

beforeEach(() => {
  visionCalls.length = 0;
  downloader.mockReset();
  downloadTelegramFile.mockReset();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(8) }))
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('imageMimeType', () => {
  it('deriva el tipo de la extensión en vez de asumir jpeg', () => {
    expect(imageMimeType('/tmp/slide-00.webp')).toBe('image/webp');
    expect(imageMimeType('/tmp/foto.PNG')).toBe('image/png');
    expect(imageMimeType('/tmp/foto.jpg')).toBe('image/jpeg');
  });
});

describe('carrusel de TikTok', () => {
  it('manda todas las diapositivas al tier vision, en orden', async () => {
    downloader.mockResolvedValue(
      carouselResponse(['https://cdn/a.webp', 'https://cdn/b.webp', 'https://cdn/c.webp'])
    );
    const { tiktokCarouselHandler } = await import(
      '../src/workers/ingestion/handlers/tiktokCarouselHandler.js'
    );

    await tiktokCarouselHandler('https://www.tiktok.com/@x/photo/1', 'item-1');

    expect(visionCalls).toHaveLength(1);
    const paths = visionCalls[0]!.imagePaths;
    expect(paths).toHaveLength(3);
    expect(paths.map((p) => p.split('/').pop())).toEqual([
      'slide-00.webp',
      'slide-01.webp',
      'slide-02.webp',
    ]);
  });

  it('conserva la extensión webp para que el data URI no mienta', async () => {
    downloader.mockResolvedValue(carouselResponse(['https://cdn/a.webp']));
    const { tiktokCarouselHandler } = await import(
      '../src/workers/ingestion/handlers/tiktokCarouselHandler.js'
    );

    await tiktokCarouselHandler('https://www.tiktok.com/@x/photo/1', 'item-1');

    expect(imageMimeType(visionCalls[0]!.imagePaths[0]!)).toBe('image/webp');
  });

  it('pasa el caption como contexto al modelo', async () => {
    downloader.mockResolvedValue(carouselResponse(['https://cdn/a.webp'], '7 estilos de UI'));
    const { tiktokCarouselHandler } = await import(
      '../src/workers/ingestion/handlers/tiktokCarouselHandler.js'
    );

    await tiktokCarouselHandler('https://www.tiktok.com/@x/photo/1', 'item-1');

    expect(visionCalls[0]!.prompt).toContain('7 estilos de UI');
  });

  it('borra las diapositivas temporales al terminar', async () => {
    downloader.mockResolvedValue(carouselResponse(['https://cdn/a.webp', 'https://cdn/b.webp']));
    const { tiktokCarouselHandler } = await import(
      '../src/workers/ingestion/handlers/tiktokCarouselHandler.js'
    );

    await tiktokCarouselHandler('https://www.tiktok.com/@x/photo/1', 'item-1');

    for (const p of visionCalls[0]!.imagePaths) {
      expect(fs.existsSync(p), `quedó sin borrar: ${p}`).toBe(false);
    }
  });

  it('lanza si la API no devuelve imágenes, en vez de producir contenido vacío', async () => {
    downloader.mockResolvedValue(carouselResponse([]));
    const { tiktokCarouselHandler } = await import(
      '../src/workers/ingestion/handlers/tiktokCarouselHandler.js'
    );

    await expect(
      tiktokCarouselHandler('https://www.tiktok.com/@x/photo/1', 'item-1')
    ).rejects.toThrow(/no carousel images/i);
  });

  it('lanza si la API responde con error', async () => {
    downloader.mockResolvedValue({ status: 'error', message: 'rate limited' });
    const { tiktokCarouselHandler } = await import(
      '../src/workers/ingestion/handlers/tiktokCarouselHandler.js'
    );

    await expect(
      tiktokCarouselHandler('https://www.tiktok.com/@x/photo/1', 'item-1')
    ).rejects.toThrow(/rate limited/);
  });
});

describe('foto enviada al bot', () => {
  it('analiza la imagen descargada y limpia el temporal', async () => {
    const cleanup = vi.fn();
    downloadTelegramFile.mockResolvedValue({ filePath: '/tmp/photo-abc.jpg', cleanup });
    const { photoHandler } = await import('../src/workers/ingestion/handlers/photoHandler.js');

    const result = await photoHandler('file-123', { caption: 'diagrama de arquitectura', itemId: 'item-2' });

    expect(visionCalls[0]!.imagePaths).toEqual(['/tmp/photo-abc.jpg']);
    expect(visionCalls[0]!.prompt).toContain('diagrama de arquitectura');
    expect(result.title).toBe('diagrama de arquitectura');
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('limpia el temporal aunque el análisis falle', async () => {
    const cleanup = vi.fn();
    downloadTelegramFile.mockResolvedValue({ filePath: '/tmp/photo-abc.jpg', cleanup });
    vi.resetModules();
    vi.doMock('../src/services/imageAnalysisService.js', () => ({
      ImageAnalysisService: {
        analyze: async () => {
          throw new Error('vision caída');
        },
      },
    }));
    const { photoHandler } = await import('../src/workers/ingestion/handlers/photoHandler.js');

    await expect(photoHandler('file-123', { itemId: 'item-3' })).rejects.toThrow('vision caída');
    expect(cleanup).toHaveBeenCalledTimes(1);
    vi.doUnmock('../src/services/imageAnalysisService.js');
  });
});
