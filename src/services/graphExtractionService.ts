import { LLMFactory } from '../core/llm/LLMFactory.js';
import { GraphExtractionResultSchema } from '../core/graphModels.js';
import type { GraphExtractionResult } from '../core/graphModels.js';
import * as dotenv from 'dotenv';

dotenv.config();

export class GraphExtractionService {
  /**
   * Extracts nodes and relations from text using the configured LLM provider and structured outputs.
   * Tracks token usage with the provided itemId.
   */
  static async extractGraph(text: string, itemId: string): Promise<GraphExtractionResult> {
    try {
      console.log('[GraphExtractionService] Requesting structured graph extraction from configured chat provider...');

      const systemPrompt = `You are an expert system that extracts entities (nodes) and relations (edges) from text to build a Knowledge Graph. 
Focus on extracting key people, organizations, locations, concepts, technologies, and how they connect.
Do not extract trivial entities. Ensure relationships are clear and informative.`;

      const parsed = await LLMFactory.getChatProvider().generateStructured<GraphExtractionResult>(
        text,
        GraphExtractionResultSchema,
        {
          modelTier: 'flash',
          systemPrompt,
          schemaName: 'graph_extraction',
          usageMeta: {
            flow: 'graph_extraction',
            itemId,
          },
        }
      );

      console.log(`[GraphExtractionService] Extracted ${parsed.nodes.length} nodes and ${parsed.edges.length} edges.`);
      return parsed;
    } catch (error) {
      console.error('[GraphExtractionService] Error extracting graph:', error);
      throw error;
    }
  }
}
