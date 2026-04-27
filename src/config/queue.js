import { Queue } from 'bullmq';
import { redis } from './redis.js';

export const publishQueue = new Queue('publish', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: 100,
    removeOnFail: 100,
  },
});