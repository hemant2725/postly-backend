import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { prisma } from '../config/db.js';
import { publishQueue } from '../config/queue.js';
import { queuePostPublish } from '../services/publisher.js';

const router = Router();

// Publish immediately
router.post('/publish', requireAuth, async (req, res, next) => {
  try {
    const { idea, post_type, platforms, tone, language, model, generated } = req.body;
    
    const post = await prisma.post.create({
      data: {
        user_id: req.userId,
        idea,
        post_type,
        tone,
        language: language || 'en',
        model_used: model,
        status: 'queued'
      }
    });
    
    await queuePostPublish(post.id, platforms, generated, req.userId);
    
    res.status(202).json({ data: { post_id: post.id, status: 'queued' } });
  } catch (err) { next(err); }
});

// Schedule for later
router.post('/schedule', requireAuth, async (req, res, next) => {
  try {
    const { idea, post_type, platforms, tone, language, model, generated, publish_at } = req.body;
    
    const post = await prisma.post.create({
      data: {
        user_id: req.userId,
        idea,
        post_type,
        tone,
        language: language || 'en',
        model_used: model,
        status: 'queued',
        publish_at: new Date(publish_at)
      }
    });
    
    await queuePostPublish(post.id, platforms, generated, req.userId);
    
    res.status(202).json({ data: { post_id: post.id, status: 'scheduled' } });
  } catch (err) { next(err); }
});

// List posts with pagination
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const status = req.query.status;
    const platform = req.query.platform;
    const date_from = req.query.date_from ? new Date(req.query.date_from) : undefined;
    const date_to = req.query.date_to ? new Date(req.query.date_to) : undefined;
    
    const where = { user_id: req.userId };
    if (status) where.status = status;
    if (date_from || date_to) {
      where.created_at = {};
      if (date_from) where.created_at.gte = date_from;
      if (date_to) where.created_at.lte = date_to;
    }
    
    let includePlatforms = true;
    if (platform) includePlatforms = { where: { platform } };
    
    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        include: { platform_posts: includePlatforms },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { created_at: 'desc' }
      }),
      prisma.post.count({ where })
    ]);
    
    res.json({ data: posts, meta: { total, page, limit }, error: null });
  } catch (err) { next(err); }
});

// Get single post
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const post = await prisma.post.findFirst({
      where: { id: req.params.id, user_id: req.userId },
      include: { platform_posts: true }
    });
    
    if (!post) return res.status(404).json({ error: 'Post not found' });
    
    res.json({ data: post, error: null });
  } catch (err) { next(err); }
});

// Retry failed posts
router.post('/:id/retry', requireAuth, async (req, res, next) => {
  try {
    const failedPosts = await prisma.platformPost.findMany({
      where: { post_id: req.params.id, status: 'failed' }
    });
    
    if (failedPosts.length === 0) {
      return res.status(400).json({ error: 'No failed platform posts to retry' });
    }
    
    for (const pp of failedPosts) {
      await prisma.platformPost.update({
        where: { id: pp.id },
        data: { status: 'queued', error_message: null }
      });
      
      await publishQueue.add(`publish-${pp.platform}`, {
        platformPostId: pp.id,
        platform: pp.platform,
        content: pp.content,
        userId: req.userId
      }, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 }
      });
    }
    
    res.json({ data: { message: 'Retry queued' } });
  } catch (err) { next(err); }
});

// Cancel scheduled post
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const post = await prisma.post.findFirst({
      where: { id: req.params.id, user_id: req.userId }
    });
    
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (post.status === 'published') {
      return res.status(400).json({ error: 'Cannot cancel published post' });
    }
    
    await prisma.post.update({
      where: { id: req.params.id },
      data: { status: 'cancelled' }
    });
    
    await prisma.platformPost.updateMany({
      where: { post_id: req.params.id, status: { not: 'published' } },
      data: { status: 'cancelled' }
    });
    
    res.json({ data: { message: 'Post cancelled' } });
  } catch (err) { next(err); }
});

export default router;