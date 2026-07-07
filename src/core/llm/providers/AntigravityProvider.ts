import type { LLMProvider, UsageMeta } from '../types.js';

/**
 * Placeholder stub for AntigravityProvider.
 * Implement when Antigravity API becomes available.
 */
export class AntigravityProvider implements LLMProvider {
  async generateCompletion(
    prompt: string,
    options?: { modelTier?: 'flash' | 'pro' | 'vision' | 'thinking'; systemPrompt?: string; usageMeta?: UsageMeta; imagePaths?: string[] }
  ): Promise<string> {
    console.log('[AntigravityProvider] generateCompletion (Stub called)');
    return `[Antigravity Mock Completion] for prompt: ${prompt}`;
  }

  async generateStructured<T>(
    prompt: string,
    schema: any,
    options?: { modelTier?: 'flash' | 'pro' | 'vision' | 'thinking'; systemPrompt?: string; schemaName: string; usageMeta?: UsageMeta }
  ): Promise<T> {
    console.log('[AntigravityProvider] generateStructured (Stub called)');
    throw new Error('AntigravityProvider structured output is not implemented yet.');
  }

  async generateEmbeddings(
    texts: string[],
    options?: { itemId?: string; usageMeta?: UsageMeta }
  ): Promise<number[][]> {
    console.log('[AntigravityProvider] generateEmbeddings (Stub called)');
    return texts.map(() => new Array(1536).fill(0));
  }
}
