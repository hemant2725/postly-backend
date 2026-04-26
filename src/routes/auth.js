import { Router } from 'express';
import { register, login, refresh, logout } from '../services/auth.js';
import { requireAuth } from '../middleware/auth.js';
import prisma from '../config/db.js';

const router = Router();

router.post('/register', async (req, res, next) => {
  try {
    const user = await register(req.body);
    res.status(201).json({ data: user });
  } catch (err) { next(err); }
});

router.post('/login', async (req, res, next) => {
  try {
    const result = await login(req.body);
    res.json({ data: result });
  } catch (err) { next(err); }
});

router.post('/refresh', async (req, res, next) => {
  try {
    const result = await refresh(req.body.refresh_token);
    res.json({ data: result });
  } catch (err) { next(err); }
});

router.post('/logout', async (req, res, next) => {
  try {
    await logout(req.body.refresh_token);
    res.json({ data: { message: 'Logged out' } });
  } catch (err) { next(err); }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, email: true, name: true, bio: true, default_tone: true, default_language: true, created_at: true }
    });
    res.json({ data: user });
  } catch (err) { next(err); }
});

export default router;
