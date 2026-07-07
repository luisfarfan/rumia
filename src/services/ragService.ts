import { pool } from '../db/index.js';
import { EmbeddingService } from './embeddingService.js';
import { LLMFactory } from '../core/llm/LLMFactory.js';
import * as dotenv from 'dotenv';

dotenv.config();

export interface RagSource {
  title?: string;
  url?: string;
}

export interface RagResult {
  answer: string;
  sources: RagSource[];
}

export class RagService {
  /**
   * Performs Hybrid RAG (Vector Search on Chunks + Neighbor Traversal in Graph)
   * and generates a grounded response using the configured LLM provider.
   * Tracks token usage with the optional sessionId.
   */
  static async answerQuery(queryText: string, sessionId?: string): Promise<RagResult> {
    console.log(`[RagService] Processing query: "${queryText}"`);

    // 1. Embed query (note: embedding generation inside RAG query doesn't belong to a document itemId, so we skip passing itemId)
    console.log('[RagService] Generating query embedding...');
    const [queryEmbedding] = await EmbeddingService.generateEmbeddings([queryText]);
    if (!queryEmbedding) {
      throw new Error('Failed to generate embedding for the user query.');
    }

    // 2. Retrieve top K (5) chunks from pgvector
    console.log('[RagService] Searching top K chunks by vector similarity...');
    const vectorStr = `[${queryEmbedding.join(',')}]`;
    const chunksQuery = `
      SELECT 
        ic.content, 
        ic.chunk_index AS "chunkIndex",
        ci.id AS "itemId",
        ci.original_url AS "originalUrl",
        ci.title AS "itemTitle",
        ci.raw_input AS "rawInput"
      FROM item_chunks ic
      JOIN captured_items ci ON ic.item_id = ci.id
      ORDER BY ic.embedding <=> $1::vector ASC
      LIMIT 5;
    `;
    const chunksResult = await pool.query(chunksQuery, [vectorStr]);
    const retrievedChunks = chunksResult.rows;

    if (retrievedChunks.length === 0) {
      console.log('[RagService] No relevant chunks found in the database.');
      return {
        answer: 'Lo siento, no encontré información relevante sobre ese tema en tu base de conocimientos personal.',
        sources: [],
      };
    }

    console.log(`[RagService] Retrieved ${retrievedChunks.length} relevant chunks.`);

    // Keep track of retrieved sources (URLs)
    const sourcesMap = new Map<string, RagSource>();
    retrievedChunks.forEach((c) => {
      const url = c.originalUrl || undefined;
      const title = c.itemTitle || c.rawInput?.slice(0, 50) || 'Documento sin título';
      if (url) {
        sourcesMap.set(url, { title, url });
      }
    });

    // 3. Extract Graph Relational context
    // Find all nodes mentioned in the retrieved chunks
    console.log('[RagService] Extracting graph relational context...');
    const chunkTexts = retrievedChunks.map((c) => c.content);
    
    // We fetch all nodes from DB to find matches in our text chunks
    const allNodesQuery = 'SELECT id, name, label FROM nodes;';
    const allNodesResult = await pool.query(allNodesQuery);
    const allNodes = allNodesResult.rows;

    const matchedNodeIds: string[] = [];
    const matchedNodeNames = new Set<string>();

    allNodes.forEach((node) => {
      const lowerNodeName = node.name.toLowerCase();
      const isMentioned = chunkTexts.some((text) => text.toLowerCase().includes(lowerNodeName));
      if (isMentioned) {
        matchedNodeIds.push(node.id);
        matchedNodeNames.add(node.name);
      }
    });

    let graphRelationsText = '';
    if (matchedNodeIds.length > 0) {
      console.log(`[RagService] Matched ${matchedNodeIds.length} entities in text chunks: ${Array.from(matchedNodeNames).join(', ')}`);
      
      // Fetch 1-degree neighbor edges for matched nodes
      const edgesQuery = `
        SELECT 
          n1.name AS "sourceName",
          n1.label AS "sourceLabel",
          e.type AS "relationship",
          n2.name AS "targetName",
          n2.label AS "targetLabel"
        FROM edges e
        JOIN nodes n1 ON e.source_node = n1.id
        JOIN nodes n2 ON e.target_node = n2.id
        WHERE e.source_node = ANY($1) OR e.target_node = ANY($1)
        LIMIT 20;
      `;
      const edgesResult = await pool.query(edgesQuery, [matchedNodeIds]);
      const relations = edgesResult.rows;

      if (relations.length > 0) {
        graphRelationsText = relations
          .map((r) => `- [${r.sourceLabel}] "${r.sourceName}" --(${r.relationship})--> [${r.targetLabel}] "${r.targetName}"`)
          .join('\n');
        console.log(`[RagService] Retrieved ${relations.length} relationships from graph.`);
      }
    }

    // 4. Build combined context
    const contextChunksText = retrievedChunks
      .map((c, i) => `[Source ${i + 1}]:\n${c.content}`)
      .join('\n\n');

    let combinedContext = `=== TEXT SEGMENTS ===\n${contextChunksText}\n\n`;
    if (graphRelationsText) {
      combinedContext += `=== GRAPH RELATIONSHIPS ===\n${graphRelationsText}\n\n`;
    }

    // 5. Query LLM to synthesize answer using LLMFactory
    console.log('[RagService] Querying configured chat provider for answer synthesis...');
    
    const systemPrompt = `You are a helpful knowledge base assistant. 
Your task is to answer the user's question using ONLY the provided context. 
If the context does not contain enough information to answer the question, state that you do not have that information. Do not invent facts.

Format your response in clean Markdown. Refer to the sources as [Source 1], [Source 2], etc. where applicable.`;

    const userMessage = `Context:\n${combinedContext}\n\nQuestion: ${queryText}`;

    const answer = await LLMFactory.getChatProvider().generateCompletion(userMessage, {
      systemPrompt,
      modelTier: 'flash',
      usageMeta: {
        flow: 'rag_query',
        sessionId,
      },
    });

    return {
      answer,
      sources: Array.from(sourcesMap.values()),
    };
  }
}
