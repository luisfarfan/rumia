import { Redis } from 'ioredis';
import type { RedisOptions } from 'ioredis';
import * as dotenv from 'dotenv';

dotenv.config();

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

/**
 * Default Redis options for BullMQ.
 * maxRetriesPerRequest must be null for BullMQ.
 */
export const redisOptions: RedisOptions = {
  maxRetriesPerRequest: null,
};

/**
 * Creates a new Redis client instance.
 * Useful since BullMQ Queue and Worker instances cannot share the same connection client.
 */
export function createRedisClient(): Redis {
  return new Redis(redisUrl, redisOptions);
}

console.log(`Redis configured to connect to: ${redisUrl}`);
