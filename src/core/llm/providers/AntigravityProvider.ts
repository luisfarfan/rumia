import type { LLMProvider } from '../types.js';

/**
 * Placeholder stub for AntigravityProvider.
 * Implement when Antigravity API becomes available.
 */
export class AntigravityProvider implements LLMProvider {
  async generateCompletion(
    prompt: string,
    options?: { modelTier?: 'flash' | 'pro'; systemPrompt?: string }
  ): Promise<string> {
    console.log('[AntigravityProvider] generateCompletion (Stub called)');
    return `[Antigravity Mock Completion] for prompt: ${prompt}`;
  }

  async generateStructured<T>(
    prompt: string,
    schema: any,
    options?: { modelTier?: 'flash' | 'pro'; systemPrompt?: string; schemaName: string }
  ): Promise<T> {
    console.log('[AntigravityProvider] generateStructured (Stub called)');
    throw new Error('AntigravityProvider structured output is not implemented yet.');
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    console.log('[AntigravityProvider] generateEmbeddings (Stub called)');
    return texts.map(() => new Array(1536).fill(0));
  }
}
