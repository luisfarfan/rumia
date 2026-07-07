import { Worker, Job } from 'bullmq';
import { createRedisClient } from '../../config/redis.js';
import { CapturedItemsRepo } from '../../db/capturedItemsRepo.js';
import { webExtractionHandler } from './handlers/webExtractionHandler.js';
import { audioTranscriptionHandler } from './handlers/audioTranscriptionHandler.js';
import { socialMediaHandler } from './handlers/socialMediaHandler.js';
import { embeddingQueue } from '../embedding/queue.js';

const workerRedisClient = createRedisClient();

export const worker = new Worker(
  'ingestionQueue',
  async (job: Job<{ itemId: string }>) => {
    const { itemId } = job.data;
    console.log(`[Worker] Started processing job ${job.id} for itemId: ${itemId}`);

    const item = await CapturedItemsRepo.findById(itemId);
    if (!item) {
      throw new Error(`Item with ID ${itemId} not found in the database.`);
    }

    const type = item.detectedSource || 'text';

    if (type === 'youtube' || type === 'tiktok') {
      if (!item.originalUrl) {
        throw new Error(`Item ${itemId} has source type ${type} but no originalUrl.`);
      }

      console.log(`[Worker] Routing item ${itemId} to Social Media Ingestion Handler`);
      await CapturedItemsRepo.update(itemId, { status: 'extracting' });
      
      const result = await socialMediaHandler(item.originalUrl, itemId);
      
      await CapturedItemsRepo.update(itemId, {
        status: 'extracted',
        title: result.title,
        content: result.content,
        error: null,
      });
      console.log(`[Worker] Item ${itemId} processed successfully via Social Media Ingestion`);

    } else if (type === 'web' || type === 'url' || (item.originalUrl && !['youtube', 'tiktok', 'instagram', 'x', 'linkedin', 'reddit', 'github', 'pdf'].includes(type))) {
      if (!item.originalUrl) {
        throw new Error(`Item ${itemId} has source type ${type} but no originalUrl.`);
      }

      console.log(`[Worker] Routing item ${itemId} to Web Extraction Handler`);
      await CapturedItemsRepo.update(itemId, { status: 'extracting' });
      
      const result = await webExtractionHandler(item.originalUrl);
      
      await CapturedItemsRepo.update(itemId, {
        status: 'extracted',
        title: result.title,
        description: result.description,
        content: result.content,
        error: null,
      });
      console.log(`[Worker] Item ${itemId} processed successfully via Web Extraction`);
      
    } else if (type === 'audio' || type === 'voice') {
      if (!item.fileId) {
        throw new Error(`Item ${itemId} has source type ${type} but no fileId.`);
      }

      console.log(`[Worker] Routing item ${itemId} to Audio Transcription Handler`);
      await CapturedItemsRepo.update(itemId, { status: 'transcribing' });
      
      const result = await audioTranscriptionHandler(item.fileId, item.fileSize);
      
      await CapturedItemsRepo.update(itemId, {
        status: 'extracted',
        content: result.content,
        error: null,
      });
      console.log(`[Worker] Item ${itemId} processed successfully via Audio Transcription`);
      
    } else {
      console.log(`[Worker] Item ${itemId} has unhandled source type: "${type}". Skipping processing.`);
      await CapturedItemsRepo.update(itemId, {
        status: 'extracted',
        content: item.rawInput,
        error: null,
      });
    }

    // Enqueue job in embeddingQueue for Phase 3 (chunking and embedding)
    try {
      await embeddingQueue.add(`embed-${itemId}`, { itemId });
      console.log(`[Worker] Successfully enqueued embedding job for item ${itemId}`);
    } catch (enqueueError) {
      console.error(`[Worker] Failed to enqueue embedding job for item ${itemId}:`, enqueueError);
    }
  },
  {
    connection: workerRedisClient as any,
    concurrency: 2, // process up to 2 items concurrently
    limiter: {
      max: 5,
      duration: 60000, // 5 jobs per minute (rate limit for media tasks)
    },
  }
);

// Global Error Event handler (terminal failures)
worker.on('failed', async (job: Job<{ itemId: string }> | undefined, err: Error) => {
  if (!job) return;
  
  const attemptsMade = job.attemptsMade;
  const maxAttempts = job.opts.attempts || 3;
  
  if (attemptsMade >= maxAttempts) {
    console.error(`[Worker] Job ${job.id} for item ${job.data.itemId} failed terminally after ${attemptsMade} attempts. Error:`, err);
    try {
      await CapturedItemsRepo.update(job.data.itemId, {
        status: 'error',
        error: err.message || String(err),
      });
    } catch (dbError) {
      console.error(`[Worker] Failed to write error status to DB for item ${job.data.itemId}:`, dbError);
    }
  } else {
    console.warn(`[Worker] Job ${job.id} failed (attempt ${attemptsMade}/${maxAttempts}). Will retry. Error:`, err.message);
  }
});

worker.on('completed', (job) => {
  console.log(`[Worker] Job ${job.id} completed successfully.`);
});

worker.on('error', (err) => {
  console.error('[Worker] Global worker error:', err);
});

console.log('BullMQ Ingestion Worker initialized and listening for jobs...');
