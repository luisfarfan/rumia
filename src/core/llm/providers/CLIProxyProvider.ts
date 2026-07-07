import { OpenAI } from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import type { LLMProvider, UsageMeta } from '../types.js';
import { TokenUsageRepo } from '../../../db/tokenUsageRepo.js';
import * as fs from 'fs';

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

  private getModel(tier?: 'flash' | 'pro' | 'vision' | 'thinking'): string {
    if (tier === 'pro') return this.proModel;
    if (tier === 'vision') return 'gpt-4o';
    if (tier === 'thinking') return 'o1-mini';
    return this.flashModel;
  }

  private recordUsage(
    usageMeta: UsageMeta | undefined,
    modelName: string,
    usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined
  ) {
    if (!usageMeta) return;

    TokenUsageRepo.saveUsage({
      itemId: usageMeta.itemId,
      sessionId: usageMeta.sessionId,
      flow: usageMeta.flow,
      provider: 'cliproxyapi',
      model: modelName,
      promptTokens: usage?.prompt_tokens ?? 0,
      completionTokens: usage?.completion_tokens ?? 0,
      totalTokens: usage?.total_tokens ?? 0,
    }).catch((err) => {
      console.error('[CLIProxyProvider] Failed to save token usage:', err);
    });
  }

  async generateCompletion(
    prompt: string,
    options?: { modelTier?: 'flash' | 'pro' | 'vision' | 'thinking'; systemPrompt?: string; usageMeta?: UsageMeta; imagePaths?: string[] }
  ): Promise<string> {
    const messages: any[] = [];
    if (options?.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }

    let userContent: any = prompt;

    // Handle image inputs for Vision models
    if (options?.imagePaths && options.imagePaths.length > 0) {
      const contentList: any[] = [{ type: 'text', text: prompt }];
      
      for (const imgPath of options.imagePaths) {
        if (fs.existsSync(imgPath)) {
          const base64Image = fs.readFileSync(imgPath, 'base64');
          contentList.push({
            type: 'image_url',
            image_url: {
              url: `data:image/jpeg;base64,${base64Image}`,
            },
          });
        }
      }
      userContent = contentList;
    }

    messages.push({ role: 'user', content: userContent });

    const response = await this.openai.chat.completions.create({
      model: this.getModel(options?.modelTier),
      messages,
    });

    this.recordUsage(options?.usageMeta, response.model, response.usage);

    return response.choices[0]?.message?.content || '';
  }

  async generateStructured<T>(
    prompt: string,
    schema: any,
    options?: { modelTier?: 'flash' | 'pro' | 'vision' | 'thinking'; systemPrompt?: string; schemaName: string; usageMeta?: UsageMeta }
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

    this.recordUsage(options?.usageMeta, response.model, response.usage);

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Failed to retrieve structured content from provider');
    }

    return JSON.parse(content) as T;
  }

  async generateEmbeddings(
    texts: string[],
    options?: { itemId?: string; usageMeta?: UsageMeta }
  ): Promise<number[][]> {
    const response = await this.openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: texts,
    });

    const meta = options?.usageMeta || (options?.itemId ? { flow: 'embedding' as const, itemId: options.itemId } : undefined);
    this.recordUsage(meta, response.model, response.usage);

    return response.data.map((d) => d.embedding);
  }
}
