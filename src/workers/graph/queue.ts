import { Queue } from 'bullmq';
import { createRedisClient } from '../../config/redis.js';

export const GRAPH_QUEUE_NAME = 'graphQueue';

const queueRedisClient = createRedisClient();

export const graphQueue = new Queue(GRAPH_QUEUE_NAME, {
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

console.log(`BullMQ Queue "${GRAPH_QUEUE_NAME}" initialized.`);
