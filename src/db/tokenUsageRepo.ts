import { pool } from './index.js';

export interface TokenUsageRecord {
  id: string;
  itemId?: string;
  sessionId?: string;
  flow: 'web_extraction' | 'chunking' | 'embedding' | 'graph_extraction' | 'rag_query' | 'fact_checking';
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  createdAt: Date;
}

export class TokenUsageRepo {
  /**
   * Saves a token usage record into the database.
   */
  static async saveUsage(usage: {
    itemId?: string;
    sessionId?: string;
    flow: string;
    provider: string;
    model: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  }): Promise<string> {
    const query = `
      INSERT INTO token_usage (item_id, session_id, flow, provider, model, prompt_tokens, completion_tokens, total_tokens)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id;
    `;
    const result = await pool.query(query, [
      usage.itemId || null,
      usage.sessionId || null,
      usage.flow,
      usage.provider,
      usage.model,
      usage.promptTokens,
      usage.completionTokens,
      usage.totalTokens,
    ]);
    return result.rows[0].id;
  }

  /**
   * Retrieves aggregated stats grouped by flow, provider, or sessionId.
   */
  static async getAggregatedStats(groupBy: 'flow' | 'provider' | 'session_id'): Promise<any[]> {
    const allowedColumns = ['flow', 'provider', 'session_id'];
    if (!allowedColumns.includes(groupBy)) {
      throw new Error(`Invalid group by column: ${groupBy}`);
    }

    const query = `
      SELECT 
        ${groupBy} AS "group",
        SUM(prompt_tokens)::int AS "totalPromptTokens",
        SUM(completion_tokens)::int AS "totalCompletionTokens",
        SUM(total_tokens)::int AS "totalTokens",
        COUNT(*)::int AS "totalCalls"
      FROM token_usage
      GROUP BY ${groupBy}
      ORDER BY "totalTokens" DESC;
    `;
    const result = await pool.query(query);
    return result.rows;
  }
}
