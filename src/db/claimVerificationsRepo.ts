import { pool } from './index.js';

export interface ClaimVerification {
  id: string;
  itemId: string;
  claim: string;
  status: 'True' | 'False' | 'Inconclusive';
  explanation: string;
  sources: { title: string; url: string }[];
  createdAt: Date;
}

export class ClaimVerificationsRepo {
  /**
   * Saves a claim verification report in the database.
   */
  static async saveVerification(verification: {
    itemId: string;
    claim: string;
    status: 'True' | 'False' | 'Inconclusive';
    explanation: string;
    sources: { title: string; url: string }[];
  }): Promise<string> {
    const query = `
      INSERT INTO claim_verifications (item_id, claim, status, explanation, sources)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id;
    `;
    const result = await pool.query(query, [
      verification.itemId,
      verification.claim,
      verification.status,
      verification.explanation,
      JSON.stringify(verification.sources),
    ]);
    return result.rows[0].id;
  }

  /**
   * Retrieves all claim verifications associated with a specific item ID.
   */
  static async findByItemId(itemId: string): Promise<ClaimVerification[]> {
    const query = `
      SELECT 
        id, 
        item_id AS "itemId", 
        claim, 
        status, 
        explanation, 
        sources, 
        created_at AS "createdAt"
      FROM claim_verifications
      WHERE item_id = $1
      ORDER BY created_at ASC;
    `;
    const result = await pool.query(query, [itemId]);
    return result.rows;
  }
}
