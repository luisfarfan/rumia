import type { LLMProvider, UsageMeta } from '../types.js';
import { TokenUsageRepo } from '../../../db/tokenUsageRepo.js';

interface OllamaEmbeddingResponse {
  model?: string;
  data?: { index?: number; embedding: number[] }[];
  usage?: { prompt_tokens?: number; total_tokens?: number };
}

/**
 * Embeddings backed by a local Ollama server through its OpenAI-compatible API.
 *
 * cliproxyapi serves no embedding model and answers `/v1/embeddings` with 404, so
 * embeddings need their own backend. This provider is embedding-only on purpose:
 * its chat methods throw rather than returning placeholder text, because a stub
 * that answers plausibly is indistinguishable from a working model until the
 * knowledge base is already full of garbage.
 */
export class OllamaProvider implements LLMProvider {
  private baseUrl: string;
  private embeddingModel: string;

  constructor() {
    const baseUrl = process.env.OLLAMA_BASE_URL;
    const model = process.env.OLLAMA_EMBEDDING_MODEL;
    if (!baseUrl || !model) {
      throw new Error(
        'OllamaProvider requires OLLAMA_BASE_URL and OLLAMA_EMBEDDING_MODEL. ' +
          'List what the server has with: GET ${OLLAMA_BASE_URL%/v1}/api/tags'
      );
    }
    // Tolerate a trailing slash so `.../v1` and `.../v1/` behave the same.
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.embeddingModel = model;
  }

  async generateCompletion(): Promise<string> {
    throw new Error(
      'OllamaProvider handles embeddings only. Point CHAT_LLM_PROVIDER at a chat provider.'
    );
  }

  async generateStructured<T>(): Promise<T> {
    throw new Error(
      'OllamaProvider handles embeddings only. Point CHAT_LLM_PROVIDER at a chat provider.'
    );
  }

  async generateEmbeddings(
    texts: string[],
    options?: { itemId?: string; usageMeta?: UsageMeta }
  ): Promise<number[][]> {
    if (texts.length === 0) return [];

    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.embeddingModel, input: texts }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(
        `Ollama embeddings request failed: ${response.status} ${response.statusText} ${detail}`.trim()
      );
    }

    const payload = (await response.json()) as OllamaEmbeddingResponse;
    const data = payload.data;
    if (!data || data.length !== texts.length) {
      throw new Error(
        `Ollama returned ${data?.length ?? 0} embeddings for ${texts.length} inputs. ` +
          'Refusing to return a misaligned result: chunks would be stored against the wrong vectors.'
      );
    }

    // The OpenAI contract allows results out of order, carrying their own index.
    const ordered = [...data].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

    const meta =
      options?.usageMeta || (options?.itemId ? { flow: 'embedding' as const, itemId: options.itemId } : undefined);
    if (meta) {
      TokenUsageRepo.saveUsage({
        itemId: meta.itemId,
        sessionId: meta.sessionId,
        flow: meta.flow,
        provider: 'ollama',
        model: payload.model || this.embeddingModel,
        promptTokens: payload.usage?.prompt_tokens ?? 0,
        completionTokens: 0,
        totalTokens: payload.usage?.total_tokens ?? 0,
      }).catch((err) => {
        console.error('[OllamaProvider] Failed to save token usage:', err);
      });
    }

    return ordered.map((entry) => entry.embedding);
  }
}
