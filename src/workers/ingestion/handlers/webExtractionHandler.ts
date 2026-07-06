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

  if (!article) {
    throw new Error(`Could not extract readable article content from URL: ${url}`);
  }

  return {
    title: article.title || doc.title || 'Untitled',
    description: description.trim(),
    content: article.textContent ? article.textContent.trim() : '',
  };
}
