import { describe, expect, it } from 'vitest';

import { detectSource, strategyFor, KNOWN_SOURCES } from '../src/core/sources.js';
import { validateSocialMediaUrl } from '../src/utils/media/urlValidator.js';

/**
 * The source table decides, for every link, which of three very different
 * readers runs: yt-dlp (download and transcribe), Open Graph (caption plus the
 * post image), or Readability (article text). Routing to the wrong one is the
 * defect that used to leave whole platforms storing their own URL as content.
 *
 * Which platforms serve Open Graph without a session was measured, not assumed —
 * every host in the `post` group answered a crawler request with a usable
 * og:title or og:description.
 */

describe('detección de plataforma', () => {
  it.each([
    ['https://www.youtube.com/watch?v=abc', 'youtube'],
    ['https://youtu.be/abc', 'youtube'],
    ['https://m.youtube.com/watch?v=abc', 'youtube'],
    ['https://vt.tiktok.com/ZSC3gB3rQ/', 'tiktok'],
    ['https://vimeo.com/123456', 'vimeo'],
    ['https://www.twitch.tv/videos/123', 'twitch'],
    ['https://soundcloud.com/user/track', 'soundcloud'],
    ['https://www.instagram.com/p/ABC/', 'instagram'],
    ['https://www.facebook.com/NASA/posts/pfbid02', 'facebook'],
    ['https://www.threads.com/@nasa/post/ABC', 'threads'],
    ['https://bsky.app/profile/x/post/abc', 'bluesky'],
    ['https://mastodon.social/@Mastodon/123', 'mastodon'],
    ['https://www.pinterest.com/pin/123/', 'pinterest'],
    ['https://x.com/OpenAI/status/1', 'x'],
    ['https://twitter.com/OpenAI/status/1', 'x'],
    ['https://github.com/langchain-ai/langgraph', 'github'],
    ['https://www.reddit.com/r/programming/', 'reddit'],
    ['https://en.wikipedia.org/wiki/RAG', 'web'],
    ['https://example.com/paper.pdf', 'pdf'],
  ])('%s → %s', (url, expected) => {
    expect(detectSource(url)).toBe(expected);
  });

  it('ignora www. y acepta subdominios de una plataforma conocida', () => {
    expect(detectSource('https://clips.twitch.tv/abc')).toBe('twitch');
    expect(detectSource('https://gist.github.com/user/1')).toBe('github');
  });

  it('una URL basura no revienta ni inventa plataforma', () => {
    expect(detectSource('no es una url')).toBeUndefined();
    expect(detectSource(undefined)).toBeUndefined();
  });
});

describe('estrategia de lectura por plataforma', () => {
  it.each([
    ['youtube', 'media'],
    ['tiktok', 'media'],
    ['vimeo', 'media'],
    ['instagram', 'post'],
    ['threads', 'post'],
    ['bluesky', 'post'],
    ['x', 'post'],
    ['github', 'web'],
    ['web', 'web'],
    ['photo', 'file'],
    ['voice', 'file'],
  ])('%s se lee como %s', (source, strategy) => {
    expect(strategyFor(source)).toBe(strategy);
  });

  it('reddit no tiene ruta: su API pide OAuth y sus og: son un stub genérico', () => {
    // Documented as `none` on purpose, so the pipeline says why instead of
    // storing the bare URL as if it were the post.
    expect(strategyFor('reddit')).toBe('none');
  });

  it('una plataforma desconocida se lee como página, no se descarta', () => {
    expect(strategyFor('algo-nuevo')).toBe('web');
  });
});

describe('validación de URLs que llegan a la línea de comandos', () => {
  it.each([
    'https://www.youtube.com/watch?v=abc',
    'https://vt.tiktok.com/ZSC3gB3rQ/',
    'https://vimeo.com/123456',
    'https://www.twitch.tv/videos/123',
    'https://soundcloud.com/user/track',
  ])('acepta %s', (url) => {
    expect(validateSocialMediaUrl(url)).toBe(true);
  });

  it.each([
    ['un host que no está en la lista', 'https://evil.example/x'],
    ['http sin cifrar', 'http://youtube.com/watch?v=a'],
    ['un intento de inyección de comandos', 'https://youtube.com/x;rm -rf /'],
    ['comillas', "https://youtube.com/x'&&curl evil"],
  ])('rechaza %s', (_label, url) => {
    expect(validateSocialMediaUrl(url)).toBe(false);
  });

  it('no cuela los metacaracteres que abría el rango `.-@` sin escapar', () => {
    // `[...-@%]` sin escapar es el rango 0x2E–0x40, que admite : ; < = > ?
    for (const char of [';', '<', '>', ':']) {
      expect(validateSocialMediaUrl(`https://youtube.com/watch${char}x`), char).toBe(false);
    }
  });
});

describe('cobertura', () => {
  it('cada plataforma conocida tiene una estrategia declarada', () => {
    for (const source of KNOWN_SOURCES) {
      expect(['media', 'post', 'web', 'none'], source).toContain(strategyFor(source));
    }
    expect(KNOWN_SOURCES.length).toBeGreaterThanOrEqual(15);
  });
});
