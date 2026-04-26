import { redis } from '../config/redis.js';

const PREFIX = 'conv';
const TTL = 30 * 60; // 30 minutes

function key(chatId) {
  return `${PREFIX}:${chatId}`;
}

export async function getState(chatId) {
  const data = await redis.get(key(chatId));
  return data ? JSON.parse(data) : null;
}

export async function setState(chatId, state) {
  await redis.setex(key(chatId), TTL, JSON.stringify(state));
}

export async function clearState(chatId) {
  await redis.del(key(chatId));
}