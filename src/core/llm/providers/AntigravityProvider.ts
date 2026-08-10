import type { LLMProvider } from '../types.js';

const NOT_IMPLEMENTED =
  'AntigravityProvider is not implemented. Select a different provider via CHAT_LLM_PROVIDER / EMBEDDING_LLM_PROVIDER.';

/**
 * Placeholder stub for AntigravityProvider.
 *
 * Every method throws. It used to answer with mock completions and zero-filled
 * vectors, which is worse than failing: mock text gets categorized, embedded and
 * written into the graph, and a corpus of zero vectors makes every similarity
 * search return the same arbitrary neighbours — both look like a working system.
 */
export class AntigravityProvider implements LLMProvider {
  async generateCompletion(): Promise<string> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async generateStructured<T>(): Promise<T> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async generateEmbeddings(): Promise<number[][]> {
    throw new Error(NOT_IMPLEMENTED);
  }
}
