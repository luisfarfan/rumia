import { pool } from '../db/index.js';
import { EmbeddingService } from './embeddingService.js';

export class EntityResolutionService {
  /**
   * Resolves a node name to an existing node ID if a highly similar node exists.
   * Otherwise, returns null.
   */
  static async resolveEntity(name: string): Promise<{ id: string; name: string } | null> {
    const client = await pool.connect();
    try {
      // 1. Check exact match (case insensitive)
      const exactQuery = 'SELECT id, name FROM nodes WHERE LOWER(name) = LOWER($1) LIMIT 1;';
      const exactResult = await client.query(exactQuery, [name]);
      if (exactResult.rows.length > 0) {
        console.log(`[EntityResolution] Exact match found for "${name}": "${exactResult.rows[0].name}"`);
        return exactResult.rows[0];
      }

      // 2. Check Trigram similarity (lexical similarity)
      // pg_trgm similarity threshold can be set, e.g., 0.8
      const trigramQuery = `
        SELECT id, name, similarity(name, $1) AS sim
        FROM nodes
        WHERE name % $1 AND similarity(name, $1) > 0.8
        ORDER BY sim DESC
        LIMIT 1;
      `;
      const trigramResult = await client.query(trigramQuery, [name]);
      if (trigramResult.rows.length > 0) {
        console.log(`[EntityResolution] Trigram match found for "${name}": "${trigramResult.rows[0].name}" (similarity: ${Number(trigramResult.rows[0].sim).toFixed(2)})`);
        return trigramResult.rows[0];
      }

      // 3. Check Vector Semantic similarity
      const apiKey = process.env.OPENAI_API_KEY;
      if (apiKey) {
        const [embedding] = await EmbeddingService.generateEmbeddings([name]);
        if (embedding) {
          const vectorStr = `[${embedding.join(',')}]`;
          const vectorQuery = `
            SELECT id, name, 1 - (embedding <=> $1::vector) AS similarity
            FROM nodes
            WHERE 1 - (embedding <=> $1::vector) > 0.9
            ORDER BY similarity DESC
            LIMIT 1;
          `;
          const vectorResult = await client.query(vectorQuery, [vectorStr]);
          if (vectorResult.rows.length > 0) {
            console.log(`[EntityResolution] Vector semantic match found for "${name}": "${vectorResult.rows[0].name}" (similarity: ${Number(vectorResult.rows[0].similarity).toFixed(2)})`);
            return vectorResult.rows[0];
          }
        }
      }
      
      return null;
    } finally {
      client.release();
    }
  }
}
