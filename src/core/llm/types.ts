export interface LLMProvider {
  /**
   * Generates a text completion based on the given prompt.
   */
  generateCompletion(
    prompt: string,
    options?: { modelTier?: 'flash' | 'pro'; systemPrompt?: string }
  ): Promise<string>;

  /**
   * Generates a structured output validated against a Zod schema.
   */
  generateStructured<T>(
    prompt: string,
    schema: any,
    options?: { modelTier?: 'flash' | 'pro'; systemPrompt?: string; schemaName: string }
  ): Promise<T>;

  /**
   * Generates embeddings for a list of texts.
   */
  generateEmbeddings(texts: string[]): Promise<number[][]>;
}
