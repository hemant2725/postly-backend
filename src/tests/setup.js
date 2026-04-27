import { publishQueue } from '../config/queue.js';
import redis from '../config/redis.js';

afterAll(async () => {
  await Promise.allSettled([
    publishQueue.close(),
    Promise.resolve(redis.disconnect()),
  ]);
});
