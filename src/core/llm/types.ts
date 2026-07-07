export interface UsageMeta {
  flow: 'web_extraction' | 'chunking' | 'embedding' | 'graph_extraction' | 'rag_query' | 'fact_checking';
  itemId?: string;
  sessionId?: string;
}

export interface LLMProvider {
  /**
   * Generates a text completion based on the given prompt.
   */
  generateCompletion(
    prompt: string,
    options?: { modelTier?: 'flash' | 'pro' | 'vision' | 'thinking'; systemPrompt?: string; usageMeta?: UsageMeta; imagePaths?: string[] }
  ): Promise<string>;

  /**
   * Generates a structured output validated against a Zod schema.
   */
  generateStructured<T>(
    prompt: string,
    schema: any,
    options?: { modelTier?: 'flash' | 'pro' | 'vision' | 'thinking'; systemPrompt?: string; schemaName: string; usageMeta?: UsageMeta }
  ): Promise<T>;

  /**
   * Generates embeddings for a list of texts.
   */
  generateEmbeddings(
    texts: string[],
    options?: { itemId?: string; usageMeta?: UsageMeta }
  ): Promise<number[][]>;
}
