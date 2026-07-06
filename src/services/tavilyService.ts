import * as dotenv from 'dotenv';

dotenv.config();

export interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

export class TavilyService {
  /**
   * Performs a web search using Tavily API.
   * Fallback to mock search in dev if API key is not configured.
   */
  static async search(query: string): Promise<TavilySearchResult[]> {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      console.warn('WARNING: TAVILY_API_KEY is not set. Returning mock search results.');
      return [
        {
          title: 'Noticia de Prueba 1',
          url: 'https://example.com/source1',
          content: `Confirmación simulada en la web sobre la consulta: "${query}". Las fuentes oficiales indican que es verídico.`,
          score: 0.95,
        },
        {
          title: 'Noticia de Prueba 2',
          url: 'https://example.com/source2',
          content: `Detalles adicionales sobre "${query}" corroborados por expertos de la industria.`,
          score: 0.88,
        },
      ];
    }

    try {
      console.log(`[TavilyService] Querying web search for: "${query}"`);
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: apiKey,
          query: query,
          search_depth: 'advanced',
          max_results: 5,
        }),
      });

      if (!response.ok) {
        throw new Error(`Tavily API returned status ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as { results: TavilySearchResult[] };
      return data.results || [];
    } catch (err) {
      console.error('Tavily search failed:', err);
      throw err;
    }
  }
}
