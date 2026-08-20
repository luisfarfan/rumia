import { Worker, Job } from 'bullmq';
import { createRedisClient } from '../../config/redis.js';
import { CapturedItemsRepo } from '../../db/capturedItemsRepo.js';
import { embeddingHandler } from './handlers/embeddingHandler.js';
import { graphQueue } from '../graph/queue.js';

const workerRedisClient = createRedisClient();

export const worker = new Worker(
  'embeddingQueue',
  async (job: Job<{ itemId: string }>) => {
    const { itemId } = job.data;
    console.log(`[EmbeddingWorker] Started processing job ${job.id} for itemId: ${itemId}`);

    // Update status to indexing (active processing)
    await CapturedItemsRepo.update(itemId, { status: 'indexing' });

    // Run chunking and embedding
    await embeddingHandler(itemId);

    // Update status to chunked_and_embedded.
    // Deliberately does NOT touch `error`: the ingestion worker stores the
    // degradation reason there (e.g. "audio transcription unavailable"), and
    // clearing it here erased the only record that an item was ingested with a
    // piece of the pipeline missing.
    await CapturedItemsRepo.update(itemId, {
      status: 'chunked_and_embedded',
    });
    console.log(`[EmbeddingWorker] Item ${itemId} successfully chunked and embedded.`);

    // Enqueue job in graphQueue for Phase 4 (knowledge graph extraction)
    try {
      await graphQueue.add(`graph-${itemId}`, { itemId });
      console.log(`[EmbeddingWorker] Successfully enqueued graph extraction job for item ${itemId}`);
    } catch (enqueueError) {
      console.error(`[EmbeddingWorker] Failed to enqueue graph extraction job for item ${itemId}:`, enqueueError);
    }
  },
  {
    connection: workerRedisClient as any,
    concurrency: 1, // Concurrency 1 to limit OpenAI rate limits
  }
);

// Global Error Event handler (terminal failures)
worker.on('failed', async (job: Job<{ itemId: string }> | undefined, err: Error) => {
  if (!job) return;

  const attemptsMade = job.attemptsMade;
  const maxAttempts = job.opts.attempts || 3;

  if (attemptsMade >= maxAttempts) {
    console.error(`[EmbeddingWorker] Job ${job.id} for item ${job.data.itemId} failed terminally after ${attemptsMade} attempts. Error:`, err);
    try {
      // An enrichment stage failing does not undo the ingestion. The item's
      // content is already stored and useful; only this stage is missing. Marking
      // it `error` would hide a perfectly good entry behind a red badge — and a
      // transient 503 from the model provider is enough to trigger it.
      const item = await CapturedItemsRepo.findById(job.data.itemId);
      const hasContent = Boolean(item?.content?.trim());
      await CapturedItemsRepo.update(job.data.itemId, {
        ...(hasContent ? {} : { status: 'error' as const }),
        error: hasContent
          ? `vectorización no disponible: ${err.message || String(err)}`
          : err.message || String(err),
      });
    } catch (dbError) {
      console.error(`[EmbeddingWorker] Failed to write error status to DB for item ${job.data.itemId}:`, dbError);
    }
  } else {
    console.warn(`[EmbeddingWorker] Job ${job.id} failed (attempt ${attemptsMade}/${maxAttempts}). Will retry. Error:`, err.message);
  }
});

worker.on('completed', (job) => {
  console.log(`[EmbeddingWorker] Job ${job.id} completed successfully.`);
});

worker.on('error', (err) => {
  console.error('[EmbeddingWorker] Global worker error:', err);
});

console.log('BullMQ Embedding Worker initialized and listening for jobs...');
