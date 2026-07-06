import { pool } from './index.js';

export interface Node {
  id: string;
  label: string;
  name: string;
  properties: Record<string, any>;
  embedding?: number[];
  createdAt: Date;
}

export interface Edge {
  id: string;
  sourceNode: string;
  targetNode: string;
  type: string;
  properties: Record<string, any>;
  itemId?: string;
  createdAt: Date;
}

export class GraphRepo {
  /**
   * Saves a node in the database.
   * If a node with the same name (case-insensitive) exists, updates its properties.
   */
  static async saveNode(node: {
    label: string;
    name: string;
    properties: Record<string, any>;
    embedding?: number[];
  }): Promise<string> {
    const vectorStr = node.embedding ? `[${node.embedding.join(',')}]` : null;
    const query = `
      INSERT INTO nodes (label, name, properties, embedding)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (LOWER(name)) DO UPDATE
      SET 
        properties = nodes.properties || EXCLUDED.properties,
        embedding = COALESCE(nodes.embedding, EXCLUDED.embedding)
      RETURNING id;
    `;
    const result = await pool.query(query, [
      node.label,
      node.name,
      JSON.stringify(node.properties),
      vectorStr,
    ]);
    return result.rows[0].id;
  }

  /**
   * Saves a directed relationship (edge) between two nodes in the database.
   * Prevents duplicates by handling unique conflicts on source, target, type and source document.
   */
  static async saveEdge(edge: {
    sourceNodeId: string;
    targetNodeId: string;
    type: string;
    properties: Record<string, any>;
    itemId?: string;
  }): Promise<string> {
    const query = `
      INSERT INTO edges (source_node, target_node, type, properties, item_id)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (source_node, target_node, type, item_id) DO UPDATE
      SET properties = edges.properties || EXCLUDED.properties
      RETURNING id;
    `;
    const result = await pool.query(query, [
      edge.sourceNodeId,
      edge.targetNodeId,
      edge.type,
      JSON.stringify(edge.properties),
      edge.itemId || null,
    ]);
    return result.rows[0].id;
  }

  /**
   * Retrieves nodes related to a topic by doing a vector search.
   */
  static async searchNodesByEmbedding(embedding: number[], limit = 5): Promise<Node[]> {
    const vectorStr = `[${embedding.join(',')}]`;
    const query = `
      SELECT id, label, name, properties, created_at AS "createdAt"
      FROM nodes
      ORDER BY embedding <=> $1::vector ASC
      LIMIT $2;
    `;
    const result = await pool.query(query, [vectorStr, limit]);
    return result.rows;
  }

  /**
   * Performs an exact lookup of a node by name.
   */
  static async findNodeByName(name: string): Promise<Node | null> {
    const query = `
      SELECT id, label, name, properties, created_at AS "createdAt"
      FROM nodes
      WHERE LOWER(name) = LOWER($1);
    `;
    const result = await pool.query(query, [name]);
    return result.rows[0] || null;
  }

  /**
   * Traverses related relationships starting from a given node ID.
   */
  static async getConnectedContext(nodeId: string, limit = 10): Promise<{
    edgeType: string;
    targetName: string;
    targetLabel: string;
  }[]> {
    const query = `
      SELECT 
        e.type AS "edgeType",
        n.name AS "targetName",
        n.label AS "targetLabel"
      FROM edges e
      JOIN nodes n ON e.target_node = n.id
      WHERE e.source_node = $1
      LIMIT $2;
    `;
    const result = await pool.query(query, [nodeId, limit]);
    return result.rows;
  }
}
