import { OpenAI } from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import type { LLMProvider } from '../types.js';

export class CLIProxyProvider implements LLMProvider {
  private openai: OpenAI;
  private flashModel: string;
  private proModel: string;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.CLIPROXY_API_KEY || process.env.OPENAI_API_KEY || 'dummy-key',
      baseURL: process.env.CLIPROXY_BASE_URL || undefined,
    });
    this.flashModel = process.env.CLIPROXY_FLASH_MODEL || 'gpt-4o-mini';
    this.proModel = process.env.CLIPROXY_PRO_MODEL || 'gpt-4o';
  }

  private getModel(tier?: 'flash' | 'pro'): string {
    return tier === 'pro' ? this.proModel : this.flashModel;
  }

  async generateCompletion(
    prompt: string,
    options?: { modelTier?: 'flash' | 'pro'; systemPrompt?: string }
  ): Promise<string> {
    const messages: any[] = [];
    if (options?.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const response = await this.openai.chat.completions.create({
      model: this.getModel(options?.modelTier),
      messages,
    });

    return response.choices[0]?.message?.content || '';
  }

  async generateStructured<T>(
    prompt: string,
    schema: any,
    options?: { modelTier?: 'flash' | 'pro'; systemPrompt?: string; schemaName: string }
  ): Promise<T> {
    const messages: any[] = [];
    if (options?.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const response = await this.openai.chat.completions.create({
      model: this.getModel(options?.modelTier),
      messages,
      response_format: zodResponseFormat(schema, options?.schemaName || 'structured_output'),
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Failed to retrieve structured content from provider');
    }

    return JSON.parse(content) as T;
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    const response = await this.openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: texts,
    });

    return response.data.map((d) => d.embedding);
  }
}
