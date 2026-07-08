import { Worker, Job } from 'bullmq';
import { createRedisClient } from '../../config/redis.js';
import { CapturedItemsRepo } from '../../db/capturedItemsRepo.js';
import { webExtractionHandler } from './handlers/webExtractionHandler.js';
import { audioTranscriptionHandler } from './handlers/audioTranscriptionHandler.js';
import { socialMediaHandler } from './handlers/socialMediaHandler.js';
import { runCategorizationAgent } from '../../agents/categorizationAgent.js';
import { runFactCheckerAgent } from '../../agents/factCheckerAgent.js';
import { embeddingQueue } from '../embedding/queue.js';

const workerRedisClient = createRedisClient();

/**
 * Truncates text to a safe character limit before passing to LLM APIs.
 */
function truncateText(text: string, maxLen: number = 8000): string {
  if (!text) return '';
  return text.length > maxLen ? text.substring(0, maxLen) : text;
}

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

    let finalContent = '';
    let finalTitle = '';
    let finalDescription = '';

    if (type === 'youtube' || type === 'tiktok') {
      if (!item.originalUrl) {
        throw new Error(`Item ${itemId} has source type ${type} but no originalUrl.`);
      }

      console.log(`[Worker] Routing item ${itemId} to Social Media Ingestion Handler`);
      await CapturedItemsRepo.update(itemId, { status: 'extracting' });
      
      const result = await socialMediaHandler(item.originalUrl, itemId);
      finalTitle = result.title;
      finalContent = result.content;
      console.log(`[Worker] Item ${itemId} processed successfully via Social Media Ingestion`);

    } else if (type === 'web' || type === 'url' || (item.originalUrl && !['youtube', 'tiktok', 'instagram', 'x', 'linkedin', 'reddit', 'github', 'pdf'].includes(type))) {
      if (!item.originalUrl) {
        throw new Error(`Item ${itemId} has source type ${type} but no originalUrl.`);
      }

      console.log(`[Worker] Routing item ${itemId} to Web Extraction Handler`);
      await CapturedItemsRepo.update(itemId, { status: 'extracting' });
      
      const result = await webExtractionHandler(item.originalUrl);
      finalTitle = result.title;
      finalDescription = result.description || '';
      finalContent = result.content;
      console.log(`[Worker] Item ${itemId} processed successfully via Web Extraction`);
      
    } else if (type === 'audio' || type === 'voice') {
      if (!item.fileId) {
        throw new Error(`Item ${itemId} has source type ${type} but no fileId.`);
      }

      console.log(`[Worker] Routing item ${itemId} to Audio Transcription Handler`);
      await CapturedItemsRepo.update(itemId, { status: 'transcribing' });
      
      const result = await audioTranscriptionHandler(item.fileId, item.fileSize);
      finalContent = result.content;
      console.log(`[Worker] Item ${itemId} processed successfully via Audio Transcription`);
      
    } else {
      console.log(`[Worker] Item ${itemId} has unhandled source type: "${type}". Skipping processing.`);
      finalContent = item.rawInput;
    }

    // --- PIPELINE STEP: Categorization (Resilient) ---
    let category = 'Other';
    let tags: string[] = [];

    const textToAnalyze = truncateText(finalContent || finalDescription || item.rawInput, 8000);
    
    if (textToAnalyze.trim()) {
      try {
        console.log(`[Worker] Invoking CategorizationAgent for item ${itemId}`);
        const catResult = await runCategorizationAgent(textToAnalyze, itemId);
        category = catResult.category;
        tags = catResult.tags;
      } catch (catError) {
        console.error(`[Worker] CategorizationAgent failed for item ${itemId}. Falling back to 'Unknown':`, catError);
        category = 'Unknown';
        tags = [];
      }

      // --- PIPELINE STEP: Conditional Fact Checking (Resilient) ---
      const factCheckingEligible = ['News', 'Opinion', 'Tutorial'];
      if (factCheckingEligible.includes(category)) {
        try {
          console.log(`[Worker] Category "${category}" is eligible for fact-checking. Invoking FactCheckerAgent...`);
          await runFactCheckerAgent(itemId, textToAnalyze);
        } catch (factError) {
          console.error(`[Worker] FactCheckerAgent failed for item ${itemId} (gracefully continuing):`, factError);
        }
      } else {
        console.log(`[Worker] Category "${category}" is not eligible for fact-checking. Skipping.`);
      }
    }

    // --- Update DB status to 'extracted' with all results ---
    await CapturedItemsRepo.update(itemId, {
      status: 'extracted',
      title: finalTitle || undefined,
      description: finalDescription || undefined,
      content: finalContent || undefined,
      category,
      tags,
      error: null,
    });

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
