import { publishQueue } from '../config/queue.js';
import { prisma } from '../config/db.js';

export async function queuePostPublish(postId, platforms, generatedContent, userId) {
  for (const platform of platforms) {
    const platformPost = await prisma.platformPost.create({
      data: {
        post_id: postId,
        platform,
        content: generatedContent[platform]?.content || '',
        status: 'queued'
      }
    });
    
    await publishQueue.add(`publish-${platform}`, {
      platformPostId: platformPost.id,
      platform,
      content: generatedContent[platform]?.content || '',
      userId
    }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 }
    });
  }
}