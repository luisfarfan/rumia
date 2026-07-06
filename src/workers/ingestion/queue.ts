import { Queue } from 'bullmq';
import { redisOptions } from '../../config/redis.js';
import { createRedisClient } from '../../config/redis.js';

export const QUEUE_NAME = 'ingestionQueue';

// We create a dedicated redis client instance for the queue
const queueRedisClient = createRedisClient();

export const ingestionQueue = new Queue(QUEUE_NAME, {
  connection: queueRedisClient as any,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000, // 5 seconds initial delay
    },
    removeOnComplete: true, // Clean up completed jobs
    removeOnFail: false,   // Keep failed jobs for inspection
  },
});

console.log(`BullMQ Queue "${QUEUE_NAME}" initialized.`);
