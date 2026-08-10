import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Instagram and Facebook posts, without a session.
 *
 * This backlog previously claimed both required authentication. That was wrong,
 * and wrong for a specific reason worth pinning: the claim was tested against
 * *profile* URLs, which are JS-rendered feeds with nothing to preview. An
 * individual public post exposes its caption and image as Open Graph tags,
 * because every link-preview card in every messaging app depends on it.
 *
 * The crawler user agent is load-bearing: with a normal browser agent Instagram
 * returns ~600KB of JavaScript and not one `og:` tag. A well-meaning cleanup of
 * that header would silently return empty entries, so it has its own test.
 */

const analyze = vi.fn(async (_paths?: string[]) => 'La imagen muestra una nebulosa planetaria con un anillo dorado.');
vi.mock('../src/services/imageAnalysisService.js', () => ({
  ImageAnalysisService: { analyze: (paths: string[]) => analyze(paths) },
}));

const POST_HTML = `<html><head>
  <meta property="og:title" content='NASA on Instagram: "A beautiful, complex ending"' />
  <meta property="og:description" content="215K likes, 1,172 comments - nasa on August 7, 2026" />
  <meta property="og:image" content="https://scontent.cdninstagram.com/v/foto_1.jpg?stp=x" />
</head><body></body></html>`;

/** What Instagram actually serves to a non-crawler agent: markup, no metadata. */
const BROWSER_HTML = '<html><head><meta charset="utf-8" /></head><body></body></html>';

function htmlResponse(html: string) {
  return { ok: true, status: 200, statusText: 'OK', text: async () => html };
}
/** Facebook serves post images from `.png` paths whose bytes are JPEG; the
 *  Content-Type is the only honest signal. */
function binaryResponse(contentType = 'image/jpeg') {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? contentType : null) },
    arrayBuffer: async () => new ArrayBuffer(16),
  };
}

/** Serves the post markup only when asked with a crawler agent, mirroring Meta. */
function metaLikeFetch(postHtml = POST_HTML) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    const agent = (init?.headers as Record<string, string> | undefined)?.['User-Agent'] ?? '';
    if (String(url).includes('cdninstagram') || String(url).includes('fbcdn')) return binaryResponse();
    return htmlResponse(agent.includes('facebookexternalhit') ? postHtml : BROWSER_HTML);
  });
}

beforeEach(() => {
  analyze.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function handler() {
  const mod = await import('../src/workers/ingestion/handlers/metaPostHandler.js');
  return mod.metaPostHandler;
}

describe('posts públicos de Instagram y Facebook', () => {
  it('pide la página con user-agent de crawler: con uno de navegador no hay metadatos', async () => {
    const fetchMock = metaLikeFetch();
    vi.stubGlobal('fetch', fetchMock);

    await (await handler())('https://www.instagram.com/p/ABC123/', 'item-1');

    const agent = (fetchMock.mock.calls[0]![1] as RequestInit).headers as Record<string, string>;
    expect(agent['User-Agent']).toContain('facebookexternalhit');
  });

  it('combina el caption con la lectura de la imagen', async () => {
    vi.stubGlobal('fetch', metaLikeFetch());

    const result = await (await handler())('https://www.instagram.com/p/ABC123/', 'item-2');

    expect(result.content).toContain('A beautiful, complex ending');
    expect(result.content).toContain('nebulosa planetaria');
    expect(result.visualAnalysisFailed).toBe(false);
    expect(analyze).toHaveBeenCalledTimes(1);
  });

  it('rechaza una URL de perfil en vez de guardar la biografía como si fuera un post', async () => {
    vi.stubGlobal('fetch', metaLikeFetch());

    await expect((await handler())('https://www.instagram.com/nasa/', 'item-3')).rejects.toThrow(
      /profile or feed/i
    );
  });

  it('acepta las formas de URL de post de ambas plataformas', async () => {
    vi.stubGlobal('fetch', metaLikeFetch());
    const run = await handler();

    for (const url of [
      'https://www.instagram.com/p/ABC123/',
      'https://www.instagram.com/reel/ABC123/',
      'https://www.facebook.com/NASA/posts/pfbid02XYZ',
    ]) {
      await expect(run(url, 'item-4')).resolves.toBeDefined();
    }
  });

  it('lanza cuando el post no expone metadatos: privado, borrado o inexistente', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => htmlResponse(BROWSER_HTML)));

    await expect((await handler())('https://www.instagram.com/p/ABC123/', 'item-5')).rejects.toThrow(
      /No Open Graph content/
    );
  });

  it('guarda la imagen según su Content-Type, no según la extensión de la URL', async () => {
    // El og:image de Facebook apunta a un `.png` cuyos bytes son JPEG. Guardarlo
    // como .png hace que el data URI declare un tipo que el contenido no tiene.
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        const agent = (init?.headers as Record<string, string> | undefined)?.['User-Agent'] ?? '';
        if (String(url).includes('fbcdn')) return binaryResponse('image/jpeg');
        return htmlResponse(
          agent.includes('facebookexternalhit')
            ? POST_HTML.replace('cdninstagram.com/v/foto_1.jpg?stp=x', 'fbcdn.net/v/foto_1.png?stp=dst-jpg')
            : BROWSER_HTML
        );
      })
    );

    await (await handler())('https://www.facebook.com/NASA/posts/pfbid02XYZ', 'item-mime');

    const [paths] = analyze.mock.calls[0] as unknown as [string[]];
    expect(paths[0]).toMatch(/\.jpg$/);
  });

  it('si la imagen no se puede leer, conserva el caption y marca la degradación', async () => {
    analyze.mockRejectedValueOnce(new Error('vision caída'));
    vi.stubGlobal('fetch', metaLikeFetch());

    const result = await (await handler())('https://www.instagram.com/p/ABC123/', 'item-6');

    expect(result.visualAnalysisFailed).toBe(true);
    expect(result.content).toContain('A beautiful, complex ending');
    expect(result.content).not.toMatch(/vision caída/);
  });
});
