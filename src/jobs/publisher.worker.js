import { Worker } from 'bullmq';
import { redis } from '../config/redis.js';
import { prisma } from '../config/db.js';
import { publishToPlatform } from '../services/platform/index.js';

const worker = new Worker('publish', async (job) => {
  const { platformPostId, platform, content, userId } = job.data;
  
  // Update status to processing
  await prisma.platformPost.update({
    where: { id: platformPostId },
    data: { status: 'processing', attempts: { increment: 1 } }
  });
  
  try {
    // Publish to platform
    await publishToPlatform(platform, content, userId);
    
    // Mark as published
    await prisma.platformPost.update({
      where: { id: platformPostId },
      data: { status: 'published', published_at: new Date(), error_message: null }
    });
    
    // Check if all platform posts are done
    const pp = await prisma.platformPost.findUnique({ where: { id: platformPostId } });
    const all = await prisma.platformPost.findMany({ where: { post_id: pp.post_id } });
    const allDone = all.every(p => ['published', 'failed', 'cancelled'].includes(p.status));
    const anyPublished = all.some(p => p.status === 'published');
    
    if (allDone) {
      await prisma.post.update({
        where: { id: pp.post_id },
        data: { status: anyPublished ? 'published' : 'failed' }
      });
    }
    
  } catch (error) {
    // Record error
    await prisma.platformPost.update({
      where: { id: platformPostId },
      data: { error_message: error.message.slice(0, 500) }
    });
    throw error; // BullMQ will retry
  }
}, {
  connection: redis,
  concurrency: 5
});

// Handle final failure after all retries
worker.on('failed', async (job, err) => {
  console.error(`Job ${job.id} failed:`, err.message);
  
  if (job.attemptsMade >= (job.opts.attempts || 3)) {
    await prisma.platformPost.update({
      where: { id: job.data.platformPostId },
      data: { status: 'failed' }
    });
    
    // Update parent post status
    const pp = await prisma.platformPost.findUnique({ where: { id: job.data.platformPostId } });
    const all = await prisma.platformPost.findMany({ where: { post_id: pp.post_id } });
    const allDone = all.every(p => ['published', 'failed', 'cancelled'].includes(p.status));
    if (allDone) {
      await prisma.post.update({
        where: { id: pp.post_id },
        data: { status: 'failed' }
      });
    }
  }
});

export default worker;