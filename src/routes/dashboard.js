import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { prisma } from '../config/db.js';

const router = Router();

router.get('/stats', requireAuth, async (req, res, next) => {
  try {
    const total = await prisma.post.count({ where: { user_id: req.userId } });
    const published = await prisma.post.count({ where: { user_id: req.userId, status: 'published' } });
    const failed = await prisma.post.count({ where: { user_id: req.userId, status: 'failed' } });
    const queued = await prisma.post.count({ where: { user_id: req.userId, status: 'queued' } });
    
    const perPlatform = await prisma.platformPost.groupBy({
      by: ['platform'],
      where: { post: { user_id: req.userId } },
      _count: { id: true }
    });
    
    res.json({
      data: {
        total_posts: total,
        published,
        failed,
        queued,
        success_rate: total > 0 ? `${((published / total) * 100).toFixed(2)}%` : '0%',
        posts_per_platform: perPlatform.map(p => ({ platform: p.platform, count: p._count.id }))
      },
      error: null
    });
  } catch (err) { next(err); }
});

export default router;