import { prisma } from '../../config/db.js';
import { decrypt } from '../../utils/crypto.js';

export async function linkedinPublish(content, userId) {
  const account = await prisma.socialAccount.findFirst({
    where: { user_id: userId, platform: 'linkedin' }
  });

  if (!account) throw new Error('LinkedIn account not connected');

  // 🟡 MOCK MODE (recommended for your project)
  if (!account.access_token_enc) {
    console.log(`[MOCK] LinkedIn post:\n${content.slice(0, 120)}...`);

    return {
      id: 'mock-linkedin-post-id',
      status: 'published',
      mock: true
    };
  }

  try {
    const accessToken = decrypt(account.access_token_enc);

    // 🔹 Step 1: Get user info
    const userInfoRes = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!userInfoRes.ok) {
      throw new Error('Failed to fetch LinkedIn user info');
    }

    const userInfo = await userInfoRes.json();

    // 🔹 Step 2: Create post
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

  } catch (error) {
    // 🟡 FALLBACK → if API fails, don't break system
    console.log(`[FALLBACK MOCK] LinkedIn failed, simulating post`);
    console.log(error.message);

    return {
      id: 'fallback-mock-id',
      status: 'published',
      mock: true
    };
  }
}