import { prisma } from '../../config/db.js';

export async function threadsPublish(content, userId) {
  const account = await prisma.socialAccount.findFirst({
    where: { user_id: userId, platform: 'threads' }
  });
  
  if (!account) throw new Error('Threads account not connected');
  
  // Threads API scaffold
  throw new Error('Threads API publishing scaffolded - awaiting API access');
}