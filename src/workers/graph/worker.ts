import { Worker, Job } from 'bullmq';
import { createRedisClient } from '../../config/redis.js';
import { CapturedItemsRepo } from '../../db/capturedItemsRepo.js';
import { graphExtractionHandler } from './handlers/graphExtractionHandler.js';

const workerRedisClient = createRedisClient();

export const worker = new Worker(
  'graphQueue',
  async (job: Job<{ itemId: string }>) => {
    const { itemId } = job.data;
    console.log(`[GraphWorker] Started processing job ${job.id} for itemId: ${itemId}`);

    const item = await CapturedItemsRepo.findById(itemId);
    if (!item) {
      throw new Error(`Item ${itemId} not found in database.`);
    }

    // Task 3.2: Verify that the item has chunked_and_embedded state before starting
    if (item.status !== 'chunked_and_embedded') {
      console.warn(`[GraphWorker] Item ${itemId} has status "${item.status}" instead of "chunked_and_embedded". Skipping processing.`);
      return;
    }

    // Call extraction handler
    await graphExtractionHandler(itemId);

    // Task 3.3: Update item status to graph_extracted upon success
    await CapturedItemsRepo.update(itemId, {
      status: 'graph_extracted',
      error: null,
    });
    console.log(`[GraphWorker] Item ${itemId} successfully extracted to Knowledge Graph.`);
  },
  {
    connection: workerRedisClient as any,
    concurrency: 1, // Concurrency 1 since graph extraction hits LLM structured output
  }
);

// Global Error Event handler (terminal failures)
worker.on('failed', async (job: Job<{ itemId: string }> | undefined, err: Error) => {
  if (!job) return;

  const attemptsMade = job.attemptsMade;
  const maxAttempts = job.opts.attempts || 3;

  if (attemptsMade >= maxAttempts) {
    console.error(`[GraphWorker] Job ${job.id} for item ${job.data.itemId} failed terminally after ${attemptsMade} attempts. Error:`, err);
    try {
      await CapturedItemsRepo.update(job.data.itemId, {
        status: 'error',
        error: err.message || String(err),
      });
    } catch (dbError) {
      console.error(`[GraphWorker] Failed to write error status to DB for item ${job.data.itemId}:`, dbError);
    }
  } else {
    console.warn(`[GraphWorker] Job ${job.id} failed (attempt ${attemptsMade}/${maxAttempts}). Will retry. Error:`, err.message);
  }
});

worker.on('completed', (job) => {
  console.log(`[GraphWorker] Job ${job.id} completed successfully.`);
});

worker.on('error', (err) => {
  console.error('[GraphWorker] Global worker error:', err);
});

console.log('BullMQ Graph Worker initialized and listening for jobs...');
