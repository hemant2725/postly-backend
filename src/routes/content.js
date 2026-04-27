import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { generateContent } from '../services/content.js';
import { z } from 'zod';

const router = Router();

const generateSchema = z.object({
  idea: z.string().max(500),
  post_type: z.enum(['announcement', 'thread', 'story', 'promotional', 'educational', 'opinion']),
  platforms: z.array(z.enum(['twitter', 'linkedin', 'instagram', 'threads'])).min(1),
  tone: z.enum(['professional', 'casual', 'witty', 'authoritative', 'friendly']),
  language: z.string().default('en'),
  model: z.enum(['openai', 'anthropic', 'groq'])
});

router.post('/generate', requireAuth, async (req, res, next) => {
  try {
    const validated = generateSchema.parse(req.body);
    const result = await generateContent({ ...validated, userId: req.userId });
    res.json({ data: result });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: err.errors });
    }
    next(err);
  }
});

export default router;
