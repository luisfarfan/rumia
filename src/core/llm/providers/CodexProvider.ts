import type { LLMProvider, UsageMeta } from '../types.js';

/**
 * Placeholder stub for CodexProvider.
 * Implement when Codex API becomes available.
 */
export class CodexProvider implements LLMProvider {
  async generateCompletion(
    prompt: string,
    options?: { modelTier?: 'flash' | 'pro' | 'vision' | 'thinking'; systemPrompt?: string; usageMeta?: UsageMeta; imagePaths?: string[] }
  ): Promise<string> {
    console.log('[CodexProvider] generateCompletion (Stub called)');
    return `[Codex Mock Completion] for prompt: ${prompt}`;
  }

  async generateStructured<T>(
    prompt: string,
    schema: any,
    options?: { modelTier?: 'flash' | 'pro' | 'vision' | 'thinking'; systemPrompt?: string; schemaName: string; usageMeta?: UsageMeta }
  ): Promise<T> {
    console.log('[CodexProvider] generateStructured (Stub called)');
    throw new Error('CodexProvider structured output is not implemented yet.');
  }

  async generateEmbeddings(
    texts: string[],
    options?: { itemId?: string; usageMeta?: UsageMeta }
  ): Promise<number[][]> {
    console.log('[CodexProvider] generateEmbeddings (Stub called)');
    return texts.map(() => new Array(1536).fill(0));
  }
}
