import { Queue } from 'bullmq';
import { createRedisClient } from '../../config/redis.js';

export const EMBEDDING_QUEUE_NAME = 'embeddingQueue';

const queueRedisClient = createRedisClient();

export const embeddingQueue = new Queue(EMBEDDING_QUEUE_NAME, {
  connection: queueRedisClient as any,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

console.log(`BullMQ Queue "${EMBEDDING_QUEUE_NAME}" initialized.`);
