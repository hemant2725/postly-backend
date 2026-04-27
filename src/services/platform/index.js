import { linkedinPublish } from './linkedin.js';
import { twitterPublish } from './twitter.js';
import { instagramPublish } from './instagram.js';
import { threadsPublish } from './threads.js';

const adapters = {
  linkedin: linkedinPublish,
  twitter: twitterPublish,
  instagram: instagramPublish,
  threads: threadsPublish
};

export async function publishToPlatform(platform, content, userId) {
  const adapter = adapters[platform];
  if (!adapter) throw new Error(`Unsupported platform: ${platform}`);
  return adapter(content, userId);
}