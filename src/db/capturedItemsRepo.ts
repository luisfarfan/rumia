import { pool } from './index.js';
import type { CapturedItem, CaptureStatus } from '../core/models.js';

export class CapturedItemsRepo {
  static async create(item: {
    userId: string;
    originalUrl?: string;
    rawInput: string;
    sourceChannel: string;
    detectedSource?: string;
    idempotencyKey?: string;
    status?: CaptureStatus;
    fileId?: string;
    fileName?: string;
    mimeType?: string;
    fileSize?: number;
  }): Promise<CapturedItem> {
    const status = item.status || 'received';
    const query = `
      INSERT INTO captured_items 
      (user_id, original_url, raw_input, source_channel, detected_source, idempotency_key, status, file_id, file_name, mime_type, file_size)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (idempotency_key) 
      DO UPDATE SET updated_at = CURRENT_TIMESTAMP
      RETURNING 
        id, 
        user_id AS "userId", 
        original_url AS "originalUrl", 
        raw_input AS "rawInput", 
        source_channel AS "sourceChannel", 
        detected_source AS "detectedSource", 
        idempotency_key AS "idempotencyKey",
        status, 
        content,
        title,
        description,
        file_id AS "fileId",
        file_name AS "fileName",
        mime_type AS "mimeType",
        file_size AS "fileSize",
        error, 
        category,
        tags,
        created_at AS "createdAt", 
        updated_at AS "updatedAt";
    `;

    const values = [
      item.userId,
      item.originalUrl || null,
      item.rawInput,
      item.sourceChannel,
      item.detectedSource || null,
      item.idempotencyKey || null,
      status,
      item.fileId || null,
      item.fileName || null,
      item.mimeType || null,
      item.fileSize || null,
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  static async findById(id: string): Promise<CapturedItem | null> {
    const query = `
      SELECT 
        id, 
        user_id AS "userId", 
        original_url AS "originalUrl", 
        raw_input AS "rawInput", 
        source_channel AS "sourceChannel", 
        detected_source AS "detectedSource", 
        idempotency_key AS "idempotencyKey",
        status, 
        content,
        title,
        description,
        file_id AS "fileId",
        file_name AS "fileName",
        mime_type AS "mimeType",
        file_size AS "fileSize",
        error, 
        category,
        tags,
        created_at AS "createdAt", 
        updated_at AS "updatedAt"
      FROM captured_items
      WHERE id = $1;
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  }

  static async update(
    id: string,
    updates: {
      status?: CaptureStatus;
      content?: string;
      title?: string;
      description?: string;
      fileId?: string;
      fileName?: string;
      mimeType?: string;
      fileSize?: number;
      error?: string | null;
      category?: string;
      tags?: string[];
    }
  ): Promise<CapturedItem | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let placeholderIndex = 1;

    if (updates.status !== undefined) {
      fields.push(`status = $${placeholderIndex++}`);
      values.push(updates.status);
    }
    if (updates.content !== undefined) {
      fields.push(`content = $${placeholderIndex++}`);
      values.push(updates.content);
    }
    if (updates.title !== undefined) {
      fields.push(`title = $${placeholderIndex++}`);
      values.push(updates.title);
    }
    if (updates.description !== undefined) {
      fields.push(`description = $${placeholderIndex++}`);
      values.push(updates.description);
    }
    if (updates.fileId !== undefined) {
      fields.push(`file_id = $${placeholderIndex++}`);
      values.push(updates.fileId);
    }
    if (updates.fileName !== undefined) {
      fields.push(`file_name = $${placeholderIndex++}`);
      values.push(updates.fileName);
    }
    if (updates.mimeType !== undefined) {
      fields.push(`mime_type = $${placeholderIndex++}`);
      values.push(updates.mimeType);
    }
    if (updates.fileSize !== undefined) {
      fields.push(`file_size = $${placeholderIndex++}`);
      values.push(updates.fileSize);
    }
    if (updates.error !== undefined) {
      fields.push(`error = $${placeholderIndex++}`);
      values.push(updates.error);
    }
    if (updates.category !== undefined) {
      fields.push(`category = $${placeholderIndex++}`);
      values.push(updates.category);
    }
    if (updates.tags !== undefined) {
      fields.push(`tags = $${placeholderIndex++}`);
      values.push(JSON.stringify(updates.tags));
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);

    values.push(id);
    const query = `
      UPDATE captured_items
      SET ${fields.join(', ')}
      WHERE id = $${placeholderIndex}
      RETURNING 
        id, 
        user_id AS "userId", 
        original_url AS "originalUrl", 
        raw_input AS "rawInput", 
        source_channel AS "sourceChannel", 
        detected_source AS "detectedSource", 
        idempotency_key AS "idempotencyKey",
        status, 
        content,
        title,
        description,
        file_id AS "fileId",
        file_name AS "fileName",
        mime_type AS "mimeType",
        file_size AS "fileSize",
        error, 
        category,
        tags,
        created_at AS "createdAt", 
        updated_at AS "updatedAt";
    `;

    const result = await pool.query(query, values);
    return result.rows[0] || null;
  }
}
