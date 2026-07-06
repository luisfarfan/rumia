import { pool } from './index.js';

export interface ItemChunk {
  id: string;
  itemId: string;
  chunkIndex: number;
  content: string;
  embedding?: number[];
  createdAt: Date;
}

export class ItemChunksRepo {
  /**
   * Inserts multiple chunks with their vector embeddings into the database.
   */
  static async createMany(
    chunks: { itemId: string; chunkIndex: number; content: string; embedding: number[] }[]
  ): Promise<void> {
    if (chunks.length === 0) return;

    // Use a transaction to insert chunks efficiently
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const query = `
        INSERT INTO item_chunks (item_id, chunk_index, content, embedding)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (item_id, chunk_index) DO NOTHING;
      `;

      for (const chunk of chunks) {
        // Format the embedding vector array as a string compatible with pgvector: '[0.1,0.2,...]'
        const vectorStr = `[${chunk.embedding.join(',')}]`;
        
        await client.query(query, [
          chunk.itemId,
          chunk.chunkIndex,
          chunk.content,
          vectorStr,
        ]);
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Finds all chunks associated with a specific item ID, ordered by chunk_index.
   */
  static async findByItemId(itemId: string): Promise<ItemChunk[]> {
    const query = `
      SELECT id, item_id AS "itemId", chunk_index AS "chunkIndex", content, created_at AS "createdAt"
      FROM item_chunks
      WHERE item_id = $1
      ORDER BY chunk_index ASC;
    `;
    const result = await pool.query(query, [itemId]);
    return result.rows;
  }

  /**
   * Deletes all chunks associated with an item.
   */
  static async deleteByItemId(itemId: string): Promise<void> {
    const query = 'DELETE FROM item_chunks WHERE item_id = $1;';
    await pool.query(query, [itemId]);
  }
}
