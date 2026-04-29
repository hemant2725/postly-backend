import "dotenv/config";
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().default('3000'),
  DATABASE_URL: z.string(),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  ENCRYPTION_KEY: z.string().min(16), // hashed to 32 bytes for AES-256
  OPENAI_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  TELEGRAM_BOT_TOKEN: z.string(),
  WEBHOOK_URL: z
    .string()
    .url()
    .refine((url) => url.startsWith('https://'), 'WEBHOOK_URL must use HTTPS')
    .optional(), // for production
}).refine(
  (parsedEnv) => parsedEnv.NODE_ENV !== 'production' || Boolean(parsedEnv.WEBHOOK_URL),
  {
    message: 'WEBHOOK_URL is required when NODE_ENV=production',
    path: ['WEBHOOK_URL']
  }
);

export const env = envSchema.parse(process.env);
