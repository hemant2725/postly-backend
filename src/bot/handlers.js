import TelegramBot from 'node-telegram-bot-api';
import { env } from '../config/env.js';
import { getState, setState, clearState } from './conversation.js';
import { prisma } from '../config/db.js';

const bot = new TelegramBot(env.TELEGRAM_BOT_TOKEN, {
  webHook: env.NODE_ENV === 'production',
  polling: false
});

if (env.NODE_ENV === 'production' && env.WEBHOOK_URL) {
  bot.setWebHook(`${env.WEBHOOK_URL}/webhook/telegram`).catch((error) => {
    console.error('Telegram webhook setup failed:', error.message);
  });
}

// Keyboard helpers
function inlineKeyboard(options) {
  return {
    reply_markup: {
      inline_keyboard: options.map(opt => [{ text: opt, callback_data: opt }])
    }
  };
}

// ========== COMMANDS ==========

bot.onText(/\/start|\/post/, async (msg) => {
  const chatId = msg.chat.id;
  
  // Find user by telegram_chat_id
  const user = await prisma.user.findUnique({ 
    where: { telegram_chat_id: String(chatId) } 
  });
  
  if (!user) {
    return bot.sendMessage(chatId, 
      'Please link your account first.\nUse: /link your@email.com yourpassword');
  }
  
  await setState(chatId, {
    step: 'awaiting_type',
    userId: user.id,
    name: user.name
  });
  
  bot.sendMessage(chatId,
    `Hey ${user.name} 👋 What type of post is this?`,
    inlineKeyboard(['Announcement', 'Thread', 'Story', 'Promotional', 'Educational', 'Opinion'])
  );
});

bot.onText(/\/link (.+) (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const email = match[1];
  const password = match[2];
  
  try {
    // Import login service dynamically to avoid circular deps
    const { login } = await import('../services/auth.js');
    const result = await login({ email, password });
    
    // Save telegram_chat_id to user
    await prisma.user.update({
      where: { id: result.user.id },
      data: { telegram_chat_id: String(chatId) }
    });
    
    bot.sendMessage(chatId, `✅ Linked! Welcome ${result.user.name}.\nUse /post to create a post.`);
  } catch (err) {
    bot.sendMessage(chatId, '❌ Link failed. Check email and password.');
  }
});

bot.onText(/\/status/, async (msg) => {
  const chatId = msg.chat.id;
  const user = await prisma.user.findUnique({ 
    where: { telegram_chat_id: String(chatId) } 
  });
  
  if (!user) return bot.sendMessage(chatId, 'Not linked. Use /link');
  
  const posts = await prisma.post.findMany({
    where: { user_id: user.id },
    include: { platform_posts: true },
    orderBy: { created_at: 'desc' },
    take: 5
  });
  
  if (posts.length === 0) return bot.sendMessage(chatId, '📭 No posts yet.');
  
  let text = '📊 Last 5 Posts:\n\n';
  posts.forEach((post, i) => {
    text += `${i + 1}. ${post.post_type.toUpperCase()}\n`;
    post.platform_posts.forEach(pp => {
      const emoji = pp.status === 'published' ? '✅' : pp.status === 'failed' ? '❌' : '⏳';
      text += `   ${emoji} ${pp.platform}: ${pp.status}\n`;
    });
    text += '\n';
  });
  
  bot.sendMessage(chatId, text);
});

bot.onText(/\/accounts/, async (msg) => {
  const chatId = msg.chat.id;
  const user = await prisma.user.findUnique({ 
    where: { telegram_chat_id: String(chatId) } 
  });
  
  if (!user) return bot.sendMessage(chatId, 'Not linked. Use /link');
  
  const accounts = await prisma.socialAccount.findMany({
    where: { user_id: user.id },
    select: { platform: true, handle: true }
  });
  
  if (accounts.length === 0) return bot.sendMessage(chatId, '🔗 No accounts connected.');
  
  const text = accounts.map(a => `• ${a.platform}${a.handle ? ` (@${a.handle})` : ''}`).join('\n');
  bot.sendMessage(chatId, `🔗 Connected Accounts:\n${text}`);
});

bot.onText(/\/help/, (msg) => {
  bot.sendMessage(msg.chat.id,
    '🤖 *Postly Bot Commands*\n\n' +
    '/start or /post - Create new post\n' +
    '/status - Last 5 posts\n' +
    '/accounts - Connected social accounts\n' +
    '/link <email> <password> - Link your account\n' +
    '/help - Show this message',
    { parse_mode: 'Markdown' }
  );
});

// ========== CONVERSATION FLOW ==========

const POST_TYPES = ['Announcement', 'Thread', 'Story', 'Promotional', 'Educational', 'Opinion'];
const PLATFORMS = ['Twitter/X', 'LinkedIn', 'Instagram', 'Threads'];
const TONES = ['Professional', 'Casual', 'Witty', 'Authoritative', 'Friendly'];
const MODELS = ['GPT-4o (OpenAI)', 'Claude Sonnet (Anthropic)'];

const PLATFORM_MAP = {
  'Twitter/X': 'twitter',
  'LinkedIn': 'linkedin',
  'Instagram': 'instagram',
  'Threads': 'threads'
};

bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;
  const state = await getState(chatId);
  
  if (!state) {
    await bot.answerCallbackQuery(query.id);
    return bot.sendMessage(chatId, '⌛ Session expired. Type /start');
  }
  
  try {
    // STEP 1: Post Type
    if (state.step === 'awaiting_type') {
      state.post_type = data.toLowerCase();
      state.step = 'awaiting_platforms';
      state.platforms = [];
      await setState(chatId, state);
      
      await bot.editMessageText('Which platforms? (Tap all that apply, then tap /done)', {
        chat_id: chatId,
        message_id: query.message.message_id,
        reply_markup: inlineKeyboard([...PLATFORMS, 'All', '/done']).reply_markup
      });
    }
    
    // STEP 2: Platforms (multi-select)
    else if (state.step === 'awaiting_platforms') {
      if (data === 'All') {
        state.platforms = ['twitter', 'linkedin', 'instagram', 'threads'];
      } else if (data === '/done') {
        if (state.platforms.length === 0) {
          await bot.answerCallbackQuery(query.id, { text: 'Select at least one!' });
          return;
        }
        state.step = 'awaiting_tone';
        await setState(chatId, state);
        
        await bot.editMessageText('What tone should the content have?', {
          chat_id: chatId,
          message_id: query.message.message_id,
          reply_markup: inlineKeyboard(TONES).reply_markup
        });
        await bot.answerCallbackQuery(query.id);
        return;
      } else {
        const mapped = PLATFORM_MAP[data] || data.toLowerCase();
        if (!state.platforms.includes(mapped)) state.platforms.push(mapped);
      }
      await setState(chatId, state);
      await bot.answerCallbackQuery(query.id, { 
        text: `Selected: ${state.platforms.join(', ')}` 
      });
    }
    
    // STEP 3: Tone
    else if (state.step === 'awaiting_tone') {
      state.tone = data.toLowerCase();
      state.step = 'awaiting_model';
      await setState(chatId, state);
      
      await bot.editMessageText('Which AI model?', {
        chat_id: chatId,
        message_id: query.message.message_id,
        reply_markup: inlineKeyboard(MODELS).reply_markup
      });
    }
    
    // STEP 4: AI Model
    else if (state.step === 'awaiting_model') {
      state.model = data.includes('GPT') ? 'openai' : 'anthropic';
      state.step = 'awaiting_idea';
      state.language = 'en'; // default, extensible later
      await setState(chatId, state);
      
      await bot.editMessageText('Tell me the idea or core message — keep it brief (max 500 chars).', {
        chat_id: chatId,
        message_id: query.message.message_id
      });
    }
    
    // STEP 5: Confirm/Edit/Cancel
    else if (state.step === 'awaiting_confirm') {
      if (data === '✅ Yes, Post Now') {
        await bot.editMessageText('🚀 Posting to queue...', {
          chat_id: chatId,
          message_id: query.message.message_id
        });
        
        // TODO: Call publish service (we'll build this after AI engine)
        await bot.sendMessage(chatId, '✅ Queued! Check /status for updates.');
        await clearState(chatId);
      }
      else if (data === '✏️ Edit Idea') {
        state.step = 'awaiting_idea';
        state.generated = null;
        await setState(chatId, state);
        
        await bot.editMessageText('Send your updated idea (max 500 chars):', {
          chat_id: chatId,
          message_id: query.message.message_id
        });
      }
      else if (data === '❌ Cancel') {
        await clearState(chatId);
        await bot.editMessageText('❌ Cancelled.', {
          chat_id: chatId,
          message_id: query.message.message_id
        });
      }
      await bot.answerCallbackQuery(query.id);
    }
  } catch (err) {
    console.error('Bot callback error:', err);
    await bot.answerCallbackQuery(query.id, { text: 'Error occurred' });
  }
});

// STEP 6: Idea Input & AI Generation
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  if (msg.text?.startsWith('/')) return;
  
  const state = await getState(chatId);
  if (!state || state.step !== 'awaiting_idea') return;
  
  if (msg.text.length > 500) {
    return bot.sendMessage(chatId, '❌ Too long! Max 500 characters.');
  }
  
  state.idea = msg.text;
  state.step = 'generating';
  await setState(chatId, state);
  
  const generatingMsg = await bot.sendMessage(chatId, '⚙️ Generating your content...');
  
  try {
    // TODO: Call AI engine (we'll build this next)
    // For now, show placeholder to test flow
    const preview = '📝 *Preview:*\n\n' +
      `🐦 Twitter/X: ${msg.text.slice(0, 100)}...\n\n` +
      `💼 LinkedIn: ${msg.text.slice(0, 200)}...\n\n` +
      '📸 Instagram: Coming soon...\n\n' +
      '🧵 Threads: Coming soon...';
    
    await bot.deleteMessage(chatId, generatingMsg.message_id);
    await bot.sendMessage(chatId, preview, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '✅ Yes, Post Now', callback_data: '✅ Yes, Post Now' }],
          [{ text: '✏️ Edit Idea', callback_data: '✏️ Edit Idea' }],
          [{ text: '❌ Cancel', callback_data: '❌ Cancel' }]
        ]
      }
    });
    
    state.step = 'awaiting_confirm';
    await setState(chatId, state);
  } catch (err) {
    console.error('Generation error:', err);
    await bot.deleteMessage(chatId, generatingMsg.message_id);
    await bot.sendMessage(chatId, `❌ Generation failed: ${err.message}`);
    await clearState(chatId);
  }
});

export default bot;
