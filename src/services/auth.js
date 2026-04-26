import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/db.js';
import { env } from '../config/env.js';

const SALT_ROUNDS = 12;
const ACCESS_TTL = '15m';
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function register({ email, password, name }) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error('Email already registered');
  
  const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await prisma.user.create({
    data: { email, password_hash, name }
  });
  return { id: user.id, email: user.email, name: user.name };
}

export async function login({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error('Invalid credentials');
  
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) throw new Error('Invalid credentials');
  
  const access_token = jwt.sign(
    { userId: user.id, email: user.email },
    env.JWT_SECRET,
    { expiresIn: ACCESS_TTL }
  );
  
  const refreshTokenValue = crypto.randomBytes(40).toString('hex');
  await prisma.refreshToken.create({
    data: {
      token: refreshTokenValue,
      user_id: user.id,
      expires_at: new Date(Date.now() + REFRESH_TTL_MS)
    }
  });
  
  return { access_token, refresh_token: refreshTokenValue, user: { id: user.id, email: user.email, name: user.name } };
}

export async function refresh(refreshToken) {
  const tokenRecord = await prisma.refreshToken.findUnique({
    where: { token: refreshToken },
    include: { user: true }
  });
  
  if (!tokenRecord || tokenRecord.expires_at < new Date()) {
    throw new Error('Invalid or expired refresh token');
  }
  
  // Rotate: delete old, create new
  await prisma.refreshToken.delete({ where: { id: tokenRecord.id } });
  
  const access_token = jwt.sign(
    { userId: tokenRecord.user.id, email: tokenRecord.user.email },
    env.JWT_SECRET,
    { expiresIn: ACCESS_TTL }
  );
  
  const newRefreshValue = crypto.randomBytes(40).toString('hex');
  await prisma.refreshToken.create({
    data: {
      token: newRefreshValue,
      user_id: tokenRecord.user.id,
      expires_at: new Date(Date.now() + REFRESH_TTL_MS)
    }
  });
  
  return { access_token, refresh_token: newRefreshValue };
}

export async function logout(refreshToken) {
  await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_SECRET);
}