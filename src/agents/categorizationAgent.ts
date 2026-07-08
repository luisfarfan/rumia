import { z } from 'zod';
import { LLMFactory } from '../core/llm/LLMFactory.js';
import * as dotenv from 'dotenv';

dotenv.config();

// Zod schema for structured categorization and tagging output
export const CategorizationResultSchema = z.object({
  category: z.enum(['News', 'Tutorial', 'Opinion', 'Entertainment', 'Documentation', 'Other'])
    .describe('Predefined category that best describes the main purpose/type of the content.'),
  tags: z.array(z.string().max(30))
    .max(5)
    .describe('Up to 5 free-form semantic tags/topics relevant to the content (all lowercase, no spaces).'),
});

export type CategorizationResult = z.infer<typeof CategorizationResultSchema>;

/**
 * Runs the Categorization Agent on a given text content to extract category and tags.
 */
export async function runCategorizationAgent(content: string, itemId: string): Promise<CategorizationResult> {
  console.log(`[CategorizationAgent] Categorizing item: ${itemId}`);
  
  const systemPrompt = `You are an expert content classifier. Read the text and extract:
1. One category from the allowed list: 'News', 'Tutorial', 'Opinion', 'Entertainment', 'Documentation', 'Other'.
2. Up to 5 relevant tags (lowercase, concise, alphanumeric only, no spaces, e.g. "typescript", "rust", "deepmind").`;

  try {
    const result = await LLMFactory.getChatProvider().generateStructured<CategorizationResult>(
      content,
      CategorizationResultSchema,
      {
        modelTier: 'flash',
        systemPrompt,
        schemaName: 'item_categorization',
        usageMeta: {
          flow: 'web_extraction',
          itemId,
        },
      }
    );

    console.log(`[CategorizationAgent] Categorized item ${itemId} as "${result.category}" with tags: ${result.tags.join(', ')}`);
    return result;
  } catch (err) {
    console.error(`[CategorizationAgent] Failed to categorize item ${itemId}:`, err);
    throw err;
  }
}
