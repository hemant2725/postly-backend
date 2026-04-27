import Redis from 'ioredis';
import { env } from './env.js';

const globalForRedis = globalThis;

export const redis = globalForRedis.redis ?? new Redis(env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

redis.on('error', (error) => {
  if (process.env.NODE_ENV !== 'test') {
    console.error('Redis connection error:', error.message);
  }
});

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis;
}

export default redis;
