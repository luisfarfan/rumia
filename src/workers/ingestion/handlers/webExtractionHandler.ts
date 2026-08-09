import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

interface WebExtractionResult {
  title: string;
  description: string;
  content: string;
}

/**
 * Downloads and extracts clean, readable text and metadata from a web URL.
 */
export async function webExtractionHandler(url: string): Promise<WebExtractionResult> {
  console.log(`Starting web extraction for URL: ${url}`);
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch URL ${url}: status ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  
  const dom = new JSDOM(html, { url });
  const doc = dom.window.document;
  
  // Extract meta description
  const descriptionMeta = doc.querySelector('meta[name="description"]') || 
                          doc.querySelector('meta[property="og:description"]');
  const description = descriptionMeta ? descriptionMeta.getAttribute('content') || '' : '';

  // Extract readable article
  const reader = new Readability(doc);
  const article = reader.parse();
  const trimmedDescription = description.trim();
  const articleText = article?.textContent?.trim() ?? '';

  if (!articleText) {
    if (!trimmedDescription) {
      throw new Error(`No readable article or meta description found for ${url}`);
    }

    console.warn(`[WebExtraction] No readable article text for ${url}. Falling back to meta description.`);
    return {
      title: article?.title || doc.title || 'Untitled',
      description: trimmedDescription,
      content: trimmedDescription,
    };
  }

  return {
    title: article?.title || doc.title || 'Untitled',
    description: trimmedDescription,
    content: articleText,
  };
}
