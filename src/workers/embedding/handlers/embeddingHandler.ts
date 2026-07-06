import { CapturedItemsRepo } from '../../../db/capturedItemsRepo.js';
import { ItemChunksRepo } from '../../../db/itemChunksRepo.js';
import { ChunkingService } from '../../../services/chunkingService.js';
import { EmbeddingService } from '../../../services/embeddingService.js';

/**
 * Handles dividing text content into semantic chunks, generating vector embeddings,
 * and saving them to the database. Supports idempotency by checking if chunks exist first.
 */
export async function embeddingHandler(itemId: string): Promise<void> {
  console.log(`[EmbeddingHandler] Starting chunking and embedding for item: ${itemId}`);

  const item = await CapturedItemsRepo.findById(itemId);
  if (!item) {
    throw new Error(`Item ${itemId} not found in database.`);
  }

  // 1. Idempotency Check: read if chunks already exist for this item
  const existingChunks = await ItemChunksRepo.findByItemId(itemId);
  if (existingChunks.length > 0) {
    console.log(`[EmbeddingHandler] Idempotency hit: Chunks already exist in database for item ${itemId} (${existingChunks.length} chunks). Skipping OpenAI and saving.`);
    return;
  }

  const content = item.content || item.rawInput;
  if (!content || content.trim() === '') {
    console.warn(`[EmbeddingHandler] Item ${itemId} has no text content. Skipping chunking and embedding.`);
    return;
  }

  // 2. Chunking: split text into semantic parts
  console.log(`[EmbeddingHandler] Splitting content for item ${itemId}`);
  const chunks = await ChunkingService.splitText(content);
  console.log(`[EmbeddingHandler] Split content into ${chunks.length} chunks.`);

  // 3. Embedding: generate vector representations
  console.log(`[EmbeddingHandler] Generating embeddings for ${chunks.length} chunks`);
  const embeddings = await EmbeddingService.generateEmbeddings(chunks);

  // 4. Persistence: save chunks and embeddings
  const mappedChunks = chunks.map((chunkText, index) => ({
    itemId,
    chunkIndex: index,
    content: chunkText,
    embedding: embeddings[index]!,
  }));

  console.log(`[EmbeddingHandler] Storing ${mappedChunks.length} chunks in the database`);
  await ItemChunksRepo.createMany(mappedChunks);
  console.log(`[EmbeddingHandler] Successfully saved all chunks for item ${itemId}`);
}
