import { prisma } from '../../config/db.js';
import { decrypt } from '../../utils/crypto.js';

export async function twitterPublish(content, userId) {
  const account = await prisma.socialAccount.findFirst({
    where: { user_id: userId, platform: 'twitter' }
  });
  
  if (!account) throw new Error('Twitter account not connected');
  
  const accessToken = decrypt(account.access_token_enc);
  
  const res = await fetch('https://api.twitter.com/2/tweets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ text: content })
  });
  
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Twitter API error: ${JSON.stringify(err)}`);
  }
  
  return await res.json();
}