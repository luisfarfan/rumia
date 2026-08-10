import { OpenAI } from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import type { LLMProvider, UsageMeta } from '../types.js';
import { TokenUsageRepo } from '../../../db/tokenUsageRepo.js';
import { imageMimeType } from '../../../utils/media/imageMime.js';
import { parseStructured, repairInstruction, structuredInstruction } from '../structuredOutput.js';
import * as fs from 'fs';

export class OpenRouterProvider implements LLMProvider {
  private openai: OpenAI;
  private flashModel: string;
  private proModel: string;
  private visionModel: string;
  private thinkingModel: string;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY || 'dummy-key',
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://rumia.local',
        'X-Title': 'Rumia',
      },
    });
    this.flashModel = process.env.OPENROUTER_FLASH_MODEL || 'openai/gpt-4o-mini';
    this.proModel = process.env.OPENROUTER_PRO_MODEL || 'openai/gpt-4o';
    // Same rule as CLIProxyProvider: tiers come from config, never from a literal
    // pinned in code. OpenRouter's catalogue is stable, so flash/pro keep defaults.
    this.visionModel = process.env.OPENROUTER_VISION_MODEL || this.flashModel;
    this.thinkingModel = process.env.OPENROUTER_THINKING_MODEL || this.proModel;
  }

  private getModel(tier?: 'flash' | 'pro' | 'vision' | 'thinking'): string {
    if (tier === 'pro') return this.proModel;
    if (tier === 'vision') return this.visionModel;
    if (tier === 'thinking') return this.thinkingModel;
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
      provider: 'openrouter',
      model: modelName,
      promptTokens: usage?.prompt_tokens ?? 0,
      completionTokens: usage?.completion_tokens ?? 0,
      totalTokens: usage?.total_tokens ?? 0,
    }).catch((err) => {
      console.error('[OpenRouterProvider] Failed to save token usage:', err);
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
              url: `data:${imageMimeType(imgPath)};base64,${base64Image}`,
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
    const responseFormat = zodResponseFormat(schema, options?.schemaName || 'structured_output');

    const messages: any[] = [];
    if (options?.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    // Same belt-and-braces as CLIProxyProvider: OpenRouter routes to many models
    // and not all of them honour `response_format`.
    messages.push({
      role: 'user',
      content: `${prompt}\n\n${structuredInstruction(responseFormat.json_schema?.schema)}`,
    });

    const ask = async (turns: any[]): Promise<string> => {
      const response = await this.openai.chat.completions.create({
        model: this.getModel(options?.modelTier),
        messages: turns,
        response_format: responseFormat,
      });
      this.recordUsage(options?.usageMeta, response.model, response.usage);

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Failed to retrieve structured content from OpenRouter');
      }
      return content;
    };

    const first = await ask(messages);
    try {
      return parseStructured<T>(first, schema);
    } catch (err) {
      console.warn('[OpenRouterProvider] Structured output unusable, retrying once:', err);
      const repaired = await ask([
        ...messages,
        { role: 'assistant', content: first },
        { role: 'user', content: repairInstruction(err) },
      ]);
      return parseStructured<T>(repaired, schema);
    }
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
