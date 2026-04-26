import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { prisma } from '../config/db.js';
import { encrypt, decrypt } from '../utils/crypto.js';

const router = Router();

router.put('/profile', requireAuth, async (req, res, next) => {
  try {
    const { name, bio, default_tone, default_language } = req.body;
    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { name, bio, default_tone, default_language }
    });
    res.json({ data: user });
  } catch (err) { next(err); }
});

router.get('/profile', requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    res.json({ data: user });
  } catch (err) { next(err); }
});

router.post('/social-accounts', requireAuth, async (req, res, next) => {
  try {
    const { platform, access_token, refresh_token, handle } = req.body;
    const account = await prisma.socialAccount.create({
      data: {
        user_id: req.userId,
        platform,
        access_token_enc: encrypt(access_token),
        refresh_token_enc: refresh_token ? encrypt(refresh_token) : null,
        handle
      }
    });
    res.status(201).json({ data: account });
  } catch (err) { next(err); }
});

router.get('/social-accounts', requireAuth, async (req, res, next) => {
  try {
    const accounts = await prisma.socialAccount.findMany({ where: { user_id: req.userId } });
    res.json({ data: accounts });
  } catch (err) { next(err); }
});

router.delete('/social-accounts/:id', requireAuth, async (req, res, next) => {
  try {
    await prisma.socialAccount.deleteMany({ where: { id: req.params.id, user_id: req.userId } });
    res.json({ data: { message: 'Disconnected' } });
  } catch (err) { next(err); }
});

router.put('/ai-keys', requireAuth, async (req, res, next) => {
  try {
    const { openai_key, anthropic_key } = req.body;
    const data = await prisma.aIKey.upsert({
      where: { user_id: req.userId },
      update: {
        openai_key_enc: openai_key ? encrypt(openai_key) : undefined,
        anthropic_key_enc: anthropic_key ? encrypt(anthropic_key) : undefined
      },
      create: {
        user_id: req.userId,
        openai_key_enc: openai_key ? encrypt(openai_key) : null,
        anthropic_key_enc: anthropic_key ? encrypt(anthropic_key) : null
      }
    });
    res.json({ data: { message: 'Keys updated' } });
  } catch (err) { next(err); }
});

export default router;