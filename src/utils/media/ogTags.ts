import { JSDOM } from 'jsdom';

export interface OpenGraphTags {
  title: string | null;
  description: string | null;
  image: string | null;
}

/**
 * The user agent Meta's own link-preview crawler sends.
 *
 * This is not cosmetic: Instagram serves a normal browser 600KB of JavaScript
 * with no `og:` tags at all, and serves the metadata only to crawler agents. It
 * is the same path every link-preview card in every messaging app goes through.
 */
const CRAWLER_USER_AGENT = 'facebookexternalhit/1.1';

/**
 * Reads a page's Open Graph tags.
 *
 * Public Instagram and Facebook posts expose their caption, engagement and image
 * URL here without any session — profile feeds do not, because a feed has no
 * single thing to preview.
 */
export async function fetchOpenGraph(url: string): Promise<OpenGraphTags> {
  const response = await fetch(url, {
    headers: { 'User-Agent': CRAWLER_USER_AGENT, Accept: 'text/html' },
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: status ${response.status} ${response.statusText}`);
  }

  const doc = new JSDOM(await response.text(), { url }).window.document;

  const meta = (property: string): string | null => {
    const el =
      doc.querySelector(`meta[property="${property}"]`) ??
      doc.querySelector(`meta[name="${property}"]`);
    const value = el?.getAttribute('content')?.trim();
    return value ? value : null;
  };

  return {
    title: meta('og:title'),
    description: meta('og:description') ?? meta('description'),
    image: meta('og:image'),
  };
}
