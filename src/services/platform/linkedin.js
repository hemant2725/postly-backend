import { prisma } from '../../config/db.js';
import { decrypt } from '../../utils/crypto.js';

export async function linkedinPublish(content, userId) {
  const account = await prisma.socialAccount.findFirst({
    where: { user_id: userId, platform: 'linkedin' }
  });
  
  if (!account) throw new Error('LinkedIn account not connected');
  
  const accessToken = decrypt(account.access_token_enc);
  
  // Get LinkedIn user info
  const userInfoRes = await fetch('https://api.linkedin.com/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  
  if (!userInfoRes.ok) throw new Error('Failed to fetch LinkedIn user info');
  const userInfo = await userInfoRes.json();
  
  // Post to LinkedIn
  const postBody = {
    author: `urn:li:person:${userInfo.sub}`,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text: content },
        shareMediaCategory: 'NONE'
      }
    },
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
    }
  };
  
  const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0'
    },
    body: JSON.stringify(postBody)
  });
  
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`LinkedIn API error: ${errText}`);
  }
  
  return await res.json();
}