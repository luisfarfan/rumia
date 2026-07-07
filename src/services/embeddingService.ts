import { LLMFactory } from '../core/llm/LLMFactory.js';
import * as dotenv from 'dotenv';

dotenv.config();

export class EmbeddingService {
  /**
   * Generates vector embeddings for a list of text chunks using the configured LLM provider.
   * Supports batching inputs to comply with provider limits and records token usage when itemId is provided.
   */
  static async generateEmbeddings(texts: string[], itemId?: string): Promise<number[][]> {
    if (texts.length === 0) return [];

    const batchSize = 500;
    const embeddings: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      console.log(`[EmbeddingService] Generating embeddings for batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(texts.length / batchSize)} (${batch.length} chunks)`);

      const batchEmbeddings = await LLMFactory.getEmbeddingProvider().generateEmbeddings(batch, {
        usageMeta: itemId ? { flow: 'embedding', itemId } : undefined,
      });
      embeddings.push(...batchEmbeddings);
    }

    return embeddings;
  }
}
