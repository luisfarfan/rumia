import { CapturedItemsRepo } from '../../../db/capturedItemsRepo.js';
import { GraphRepo } from '../../../db/graphRepo.js';
import { GraphExtractionService } from '../../../services/graphExtractionService.js';
import { EntityResolutionService } from '../../../services/entityResolutionService.js';
import { EmbeddingService } from '../../../services/embeddingService.js';

/**
 * Handles extracting a Knowledge Graph (nodes and relationships) from an item's content.
 * Performs Entity Resolution on each node to prevent duplication, then saves nodes and edges to the database.
 */
export async function graphExtractionHandler(itemId: string): Promise<void> {
  console.log(`[GraphExtractionHandler] Starting Knowledge Graph extraction for item: ${itemId}`);

  const item = await CapturedItemsRepo.findById(itemId);
  if (!item) {
    throw new Error(`Item ${itemId} not found in database.`);
  }

  // Task 3.2: Verify that the item has chunked_and_embedded state before proceeding (or during queueing)
  if (item.status !== 'chunked_and_embedded') {
    console.warn(`[GraphExtractionHandler] Item ${itemId} has status "${item.status}" instead of "chunked_and_embedded". Skipping extraction.`);
    return;
  }

  const content = item.content || item.rawInput;
  if (!content || content.trim() === '') {
    console.warn(`[GraphExtractionHandler] Item ${itemId} has no text content. Skipping graph extraction.`);
    return;
  }

  // 1. Extract raw nodes & edges using LLM structured outputs (passing itemId for token usage tracking)
  const extractionResult = await GraphExtractionService.extractGraph(content, itemId);
  
  if (extractionResult.nodes.length === 0) {
    console.log(`[GraphExtractionHandler] No entities extracted for item ${itemId}.`);
    return;
  }

  // 2. Resolve entities & save nodes
  const resolvedNodesMap = new Map<string, string>(); // name -> node UUID

  console.log(`[GraphExtractionHandler] Resolving and saving ${extractionResult.nodes.length} nodes...`);
  for (const node of extractionResult.nodes) {
    // Check if node already exists via Entity Resolution (exact, trigram or vector similarity)
    const resolved = await EntityResolutionService.resolveEntity(node.name);
    
    let nodeId: string;
    if (resolved) {
      nodeId = resolved.id;
      // Also update the map with the resolved name so edges connect correctly
      resolvedNodesMap.set(node.name, nodeId);
      console.log(`[GraphExtractionHandler] Resolved entity "${node.name}" to existing node ID ${nodeId}`);
    } else {
      // If it is a new node, generate its embedding for future similarity queries (passing itemId for tracking)
      const [embedding] = await EmbeddingService.generateEmbeddings([node.name], itemId);
      
      nodeId = await GraphRepo.saveNode({
        label: node.label,
        name: node.name,
        properties: node.properties,
        embedding: embedding,
      });
      resolvedNodesMap.set(node.name, nodeId);
      console.log(`[GraphExtractionHandler] Saved new entity "${node.name}" as node ID ${nodeId}`);
    }
  }

  // 3. Save edges
  console.log(`[GraphExtractionHandler] Saving ${extractionResult.edges.length} relationships...`);
  for (const edge of extractionResult.edges) {
    // Find the resolved UUIDs for source and target
    const sourceNodeId = resolvedNodesMap.get(edge.source);
    const targetNodeId = resolvedNodesMap.get(edge.target);

    if (!sourceNodeId || !targetNodeId) {
      console.warn(`[GraphExtractionHandler] Skipping edge [${edge.source} -> ${edge.type} -> ${edge.target}] because one of the nodes could not be resolved.`);
      continue;
    }

    const edgeId = await GraphRepo.saveEdge({
      sourceNodeId,
      targetNodeId,
      type: edge.type,
      properties: edge.properties,
      itemId,
    });
    console.log(`[GraphExtractionHandler] Saved relationship: ${edge.source} (${sourceNodeId}) --[${edge.type}]--> ${edge.target} (${targetNodeId})`);
  }

  console.log(`[GraphExtractionHandler] Knowledge Graph extraction completed for item ${itemId}`);
}
