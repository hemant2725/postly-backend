import crypto from 'crypto';
import { env } from '../config/env.js';

const ALGORITHM = 'aes-256-gcm';

export function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(env.ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export function decrypt(encryptedData) {
  const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    Buffer.from(env.ENCRYPTION_KEY),
    Buffer.from(ivHex, 'hex')
  );
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}