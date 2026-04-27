import { prisma } from '../../config/db.js';

export async function instagramPublish(content, userId) {
  const account = await prisma.socialAccount.findFirst({
    where: { user_id: userId, platform: 'instagram' }
  });
  
  if (!account) throw new Error('Instagram account not connected');
  
  // Instagram Graph API requires media upload + caption
  // Scaffolded: implement when API access is available
  throw new Error('Instagram publishing scaffolded - requires media upload pipeline');
}