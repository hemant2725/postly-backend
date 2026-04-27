import TelegramBot from 'node-telegram-bot-api';
import { env } from '../config/env.js';
import { getState, setState, clearState } from './conversation.js';
import { prisma } from '../config/db.js';
import { generateContent } from '../services/content.js';

const isProduction = env.NODE_ENV === 'production';

const bot = new TelegramBot(env.TELEGRAM_BOT_TOKEN, {
  webHook: isProduction,
  polling: false
});

const POST_TYPES = ['Announcement', 'Thread', 'Story', 'Promotional', 'Educational', 'Opinion'];
const PLATFORMS = ['Twitter/X', 'LinkedIn', 'Instagram', 'Threads'];
const TONES = ['Professional', 'Casual', 'Witty', 'Authoritative', 'Friendly'];
const MODELS = ['GPT-OSS 120B (Groq)', 'GPT-4o (OpenAI)(Coming Soon...)', 'Claude Sonnet (Anthropic)(Coming Soon...)'];

const PLATFORM_MAP = {
  'Twitter/X': 'twitter',
  LinkedIn: 'linkedin',
  Instagram: 'instagram',
  Threads: 'threads'
};

async function initializeBot() {
  try {
    if (isProduction && env.WEBHOOK_URL) {
      await bot.setWebHook(`${env.WEBHOOK_URL}/webhook/telegram`);
      console.log('Telegram bot webhook configured.');
      return;
    }

    await bot.deleteWebHook({ drop_pending_updates: false });
    await bot.startPolling({ restart: true });
    console.log('Telegram bot polling started for local development.');
  } catch (error) {
    console.error('Telegram bot initialization failed:', error.message);
  }
}

initializeBot();

function inlineKeyboard(options) {
  return {
    reply_markup: {
      inline_keyboard: options.map((option) => [{ text: option, callback_data: option }])
    }
  };
}

function previewTextFor(platformData) {
  if (!platformData) {
    return 'Not generated.';
  }

  if (typeof platformData === 'string') {
    return platformData;
  }

  if (typeof platformData.content === 'string') {
    return platformData.content;
  }

  return JSON.stringify(platformData);
}

function buildPreviewMessage(generated) {
  const lines = ['Preview:', ''];

  if (generated.twitter) {
    lines.push(`Twitter/X: ${previewTextFor(generated.twitter)}`, '');
  }

  if (generated.linkedin) {
    lines.push(`LinkedIn: ${previewTextFor(generated.linkedin)}`, '');
  }

  if (generated.instagram) {
    lines.push(`Instagram: ${previewTextFor(generated.instagram)}`, '');
  }

  if (generated.threads) {
    lines.push(`Threads: ${previewTextFor(generated.threads)}`, '');
  }

  return lines.join('\n').trim();
}

async function findLinkedUser(chatId) {
  return prisma.user.findUnique({
    where: { telegram_chat_id: String(chatId) }
  });
}

bot.onText(/\/start|\/post/, async (msg) => {
  const chatId = msg.chat.id;
  const user = await findLinkedUser(chatId);

  if (!user) {
    return bot.sendMessage(chatId, 'Please link your account first.\nUse: /link your@email.com yourpassword');
  }

  await setState(chatId, {
    step: 'awaiting_type',
    userId: user.id,
    name: user.name
  });

  await bot.sendMessage(
    chatId,
    `Hey ${user.name}. What type of post is this?`,
    inlineKeyboard(POST_TYPES)
  );
});

bot.onText(/\/link (.+) (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const email = match[1];
  const password = match[2];

  try {
    const { login } = await import('../services/auth.js');
    const result = await login({ email, password });

    await prisma.user.update({
      where: { id: result.user.id },
      data: { telegram_chat_id: String(chatId) }
    });

    await bot.sendMessage(chatId, `Linked. Welcome ${result.user.name}.\nUse /post to create a post.`);
  } catch (error) {
    await bot.sendMessage(chatId, 'Link failed. Check email and password.');
  }
});

bot.onText(/\/status/, async (msg) => {
  const chatId = msg.chat.id;
  const user = await findLinkedUser(chatId);

  if (!user) {
    return bot.sendMessage(chatId, 'Not linked. Use /link');
  }

  const posts = await prisma.post.findMany({
    where: { user_id: user.id },
    include: { platform_posts: true },
    orderBy: { created_at: 'desc' },
    take: 5
  });

  if (posts.length === 0) {
    return bot.sendMessage(chatId, 'No posts yet.');
  }

  let text = 'Last 5 Posts:\n\n';

  posts.forEach((post, index) => {
    text += `${index + 1}. ${post.post_type.toUpperCase()}\n`;

    post.platform_posts.forEach((platformPost) => {
      text += `   ${platformPost.platform}: ${platformPost.status}\n`;
    });

    text += '\n';
  });

  await bot.sendMessage(chatId, text);
});

bot.onText(/\/accounts/, async (msg) => {
  const chatId = msg.chat.id;
  const user = await findLinkedUser(chatId);

  if (!user) {
    return bot.sendMessage(chatId, 'Not linked. Use /link');
  }

  const accounts = await prisma.socialAccount.findMany({
    where: { user_id: user.id },
    select: { platform: true, handle: true }
  });

  if (accounts.length === 0) {
    return bot.sendMessage(chatId, 'No accounts connected.');
  }

  const text = accounts
    .map((account) => `- ${account.platform}${account.handle ? ` (@${account.handle})` : ''}`)
    .join('\n');

  await bot.sendMessage(chatId, `Connected Accounts:\n${text}`);
});

bot.onText(/\/help/, async (msg) => {
  await bot.sendMessage(
    msg.chat.id,
    'Postly Bot Commands\n\n/start or /post - Create new post\n/status - Last 5 posts\n/accounts - Connected social accounts\n/link <email> <password> - Link your account\n/help - Show this message'
  );
});

bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;
  const state = await getState(chatId);

  if (!state) {
    await bot.answerCallbackQuery(query.id);
    return bot.sendMessage(chatId, 'Session expired. Type /start');
  }

  try {
    if (state.step === 'awaiting_type') {
      state.post_type = data.toLowerCase();
      state.step = 'awaiting_platforms';
      state.platforms = [];
      await setState(chatId, state);

      await bot.editMessageText('Which platforms? Tap all that apply, then tap /done.', {
        chat_id: chatId,
        message_id: query.message.message_id,
        reply_markup: inlineKeyboard([...PLATFORMS, 'All', '/done']).reply_markup
      });
    } else if (state.step === 'awaiting_platforms') {
      if (data === 'All') {
        state.platforms = ['twitter', 'linkedin', 'instagram', 'threads'];
      } else if (data === '/done') {
        if (state.platforms.length === 0) {
          await bot.answerCallbackQuery(query.id, { text: 'Select at least one.' });
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

        if (!state.platforms.includes(mapped)) {
          state.platforms.push(mapped);
        }
      }

      await setState(chatId, state);
      await bot.answerCallbackQuery(query.id, {
        text: `Selected: ${state.platforms.join(', ')}`
      });
    } else if (state.step === 'awaiting_tone') {
      state.tone = data.toLowerCase();
      state.step = 'awaiting_model';
      await setState(chatId, state);

      await bot.editMessageText('Which AI model?', {
        chat_id: chatId,
        message_id: query.message.message_id,
        reply_markup: inlineKeyboard(MODELS).reply_markup
      });
    } else if (state.step === 'awaiting_model') {
      if (data.includes('Groq')) {
        state.model = 'groq';
      } else if (data.includes('GPT')) {
        state.model = 'openai';
      } else {
        state.model = 'anthropic';
      }

      state.step = 'awaiting_idea';
      state.language = 'en';
      await setState(chatId, state);

      await bot.editMessageText('Tell me the idea or core message - keep it brief (max 500 chars).', {
        chat_id: chatId,
        message_id: query.message.message_id
      });
    } else if (state.step === 'awaiting_confirm') {
      if (data === 'Yes, Post Now') {
        await bot.editMessageText('Posting to queue...', {
          chat_id: chatId,
          message_id: query.message.message_id
        });

        await bot.sendMessage(chatId, 'Queued. Check /status for updates.');
        await clearState(chatId);
      } else if (data === 'Edit Idea') {
        state.step = 'awaiting_idea';
        state.generated = null;
        await setState(chatId, state);

        await bot.editMessageText('Send your updated idea (max 500 chars):', {
          chat_id: chatId,
          message_id: query.message.message_id
        });
      } else if (data === 'Cancel') {
        await clearState(chatId);
        await bot.editMessageText('Cancelled.', {
          chat_id: chatId,
          message_id: query.message.message_id
        });
      }

      await bot.answerCallbackQuery(query.id);
    }
  } catch (error) {
    console.error('Bot callback error:', error);
    await bot.answerCallbackQuery(query.id, { text: 'Error occurred' });
  }
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;

  if (msg.text?.startsWith('/')) {
    return;
  }

  const state = await getState(chatId);

  if (!state || state.step !== 'awaiting_idea') {
    return;
  }

  if (msg.text.length > 500) {
    return bot.sendMessage(chatId, 'Too long. Max 500 characters.');
  }

  state.idea = msg.text;
  state.step = 'generating';
  await setState(chatId, state);

  const generatingMsg = await bot.sendMessage(chatId, 'Generating your content...');

  try {
    const result = await generateContent({
      idea: state.idea,
      post_type: state.post_type,
      platforms: state.platforms,
      tone: state.tone,
      language: state.language,
      model: state.model,
      userId: state.userId
    });

    state.generated = result.generated;
    state.model_used = result.model_used;
    state.tokens_used = result.tokens_used;
    state.step = 'awaiting_confirm';
    await setState(chatId, state);

    const preview = buildPreviewMessage(result.generated);

    await bot.deleteMessage(chatId, generatingMsg.message_id);
    await bot.sendMessage(chatId, preview, {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Yes, Post Now', callback_data: 'Yes, Post Now' }],
          [{ text: 'Edit Idea', callback_data: 'Edit Idea' }],
          [{ text: 'Cancel', callback_data: 'Cancel' }]
        ]
      }
    });
  } catch (error) {
    console.error('Generation error:', error);

    await bot.deleteMessage(chatId, generatingMsg.message_id);
    await bot.sendMessage(chatId, `Generation failed: ${error.message}`);
    await clearState(chatId);
  }
});

export default bot;
