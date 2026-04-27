import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '../config/db.js';
import { env } from '../config/env.js';
import { decrypt } from '../utils/crypto.js';

const PLATFORM_CONSTRAINTS = {
  twitter: {
    max_chars: 280,
    hashtags: 'exactly 2-3 hashtags',
    style: 'punchy, viral opener, short and impactful'
  },
  linkedin: {
    min_chars: 800,
    max_chars: 1300,
    hashtags: 'exactly 3-5 hashtags',
    style: 'professional tone regardless of global tone setting, structured, thought leadership'
  },
  instagram: {
    hashtags: 'exactly 10-15 hashtags',
    style: 'caption style, emoji-friendly, engaging, personal'
  },
  threads: {
    max_chars: 500,
    style: 'conversational, casual, thread-style storytelling'
  }
};

function buildSystemPrompt(postType, tone, language, platforms) {
  const formatLines = [];
  const ruleLines = [];

  for (const platform of platforms) {
    const constraint = PLATFORM_CONSTRAINTS[platform];

    if (platform === 'twitter') {
      formatLines.push(`"twitter": { "content": "...", "hashtags": [] }`);
    }

    if (platform === 'linkedin') {
      formatLines.push(`"linkedin": { "content": "..." }`);
    }

    if (platform === 'instagram') {
      formatLines.push(`"instagram": { "content": "...", "hashtags": [] }`);
    }

    if (platform === 'threads') {
      formatLines.push(`"threads": { "content": "..." }`);
    }

    let rule = `- ${platform.toUpperCase()}:`;

    if (constraint.max_chars) {
      rule += ` max ${constraint.max_chars} chars;`;
    }

    if (constraint.min_chars) {
      rule += ` ${constraint.min_chars}-${constraint.max_chars} chars;`;
    }

    if (constraint.style) {
      rule += ` ${constraint.style};`;
    }

    if (constraint.hashtags) {
      rule += ` include ${constraint.hashtags};`;
    }

    ruleLines.push(rule);
  }

  return `Generate JSON output ONLY. No extra text, no markdown, no labels.

POST TYPE: ${postType}
TONE: ${tone}
LANGUAGE: ${language}

Required JSON shape:
{
  ${formatLines.join(',\n  ')}
}

Rules:
${ruleLines.join('\n')}
- Return valid JSON only
- Do not include labels like "Twitter:" or "LinkedIn:"
- Include only the requested platforms

Idea: ${platforms.join(', ')} content about "${postType}" in tone "${tone}" based on: ${language} :: `;
}

async function getProviderKeys(userId) {
  const userKeys = await prisma.aIKey.findUnique({
    where: { user_id: userId }
  });

  let openaiKey = env.OPENAI_API_KEY;
  let groqKey = env.GROQ_API_KEY;
  let anthropicKey = env.ANTHROPIC_API_KEY;

  if (userKeys?.openai_key_enc) {
    openaiKey = decrypt(userKeys.openai_key_enc);
  }

  if (userKeys?.anthropic_key_enc) {
    anthropicKey = decrypt(userKeys.anthropic_key_enc);
  }

  return { openaiKey, groqKey, anthropicKey };
}

function parseGeneratedResponse(rawResponse, platforms) {
  if (rawResponse && typeof rawResponse === 'object') {
    for (const platform of platforms) {
      if (!rawResponse[platform]) {
        throw new Error(`AI response missing platform: ${platform}`);
      }
    }

    return rawResponse;
  }

  if (typeof rawResponse !== 'string' || !rawResponse.trim()) {
    throw new Error('AI provider returned an empty response');
  }

  const cleaned = rawResponse.replace(/```json|```/g, '').trim();
  let generated;

  try {
    generated = JSON.parse(cleaned);
  } catch (error) {
    console.log('Raw output:', cleaned);
    throw new Error('Invalid JSON from AI');
  }

  for (const platform of platforms) {
    if (!generated[platform]) {
      throw new Error(`AI response missing platform: ${platform}`);
    }
  }

  return generated;
}

function buildFallbackStructuredContent(text, platforms) {
  const generated = {};

  for (const platform of platforms) {
    if (platform === 'twitter') {
      generated.twitter = {
        content: text.slice(0, 280),
        char_count: Math.min(text.length, 280),
        hashtags: ['#AI', '#Startup']
      };
    }

    if (platform === 'linkedin') {
      generated.linkedin = {
        content: text,
        char_count: text.length
      };
    }

    if (platform === 'instagram') {
      generated.instagram = {
        content: text,
        hashtags: ['#AI', '#Startup', '#Productivity', '#Launch', '#Innovation', '#Tech', '#Builder', '#Growth', '#SaaS', '#Content']
      };
    }

    if (platform === 'threads') {
      generated.threads = {
        content: text.slice(0, 500)
      };
    }
  }

  return generated;
}

function extractGroqMessageContent(message) {
  if (!message) {
    return null;
  }

  if (typeof message.content === 'string' && message.content.trim()) {
    return message.content.trim();
  }

  if (Array.isArray(message.content)) {
    const text = message.content
      .map((item) => {
        if (typeof item === 'string') {
          return item;
        }

        if (item?.type === 'text' && typeof item.text === 'string') {
          return item.text;
        }

        return '';
      })
      .join('\n')
      .trim();

    if (text) {
      return text;
    }
  }

  return null;
}

async function generateWithOpenAI({ apiKey, systemPrompt, idea, platforms }) {
  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const client = new OpenAI({ apiKey });
  const completion = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: idea }
    ],
    temperature: 0.7,
    response_format: { type: 'json_object' }
  });

  return {
    generated: parseGeneratedResponse(completion.choices[0]?.message?.content, platforms),
    model_used: completion.model,
    tokens_used: completion.usage?.total_tokens || 0
  };
}

async function generateWithGroq({ apiKey, systemPrompt, idea, platforms }) {
  if (!apiKey) {
    throw new Error('Groq API key not configured');
  }

  const client = new OpenAI({
    apiKey,
    baseURL: 'https://api.groq.com/openai/v1'
  });

  const completion = await client.chat.completions.create({
    model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
    messages: [
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user',
        content: `Idea: ${idea}`
      }
    ],
    temperature: 0.2
  });

  const rawContent = extractGroqMessageContent(completion.choices[0]?.message);

  if (!rawContent) {
    const fallbackCompletion = await client.chat.completions.create({
      model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
      messages: [
        {
          role: 'system',
          content: 'Write polished platform-ready social media content. Return plain text only.'
        },
        {
          role: 'user',
          content: `Idea: ${idea}\nTone: professional\nPlatforms: ${platforms.join(', ')}`
        }
      ],
      temperature: 0.2
    });

    const fallbackText = extractGroqMessageContent(fallbackCompletion.choices[0]?.message);

    if (!fallbackText) {
      throw new Error('Groq returned an empty response');
    }

    return {
      generated: buildFallbackStructuredContent(fallbackText, platforms),
      model_used: fallbackCompletion.model,
      tokens_used: fallbackCompletion.usage?.total_tokens || 0
    };
  }

  return {
    generated: parseGeneratedResponse(rawContent, platforms),
    model_used: completion.model,
    tokens_used: completion.usage?.total_tokens || 0
  };
}

async function generateWithClaude({ apiKey, systemPrompt, idea, platforms }) {
  if (!apiKey) {
    throw new Error('Anthropic API key not configured');
  }

  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model: 'claude-3-sonnet-20240229',
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: 'user', content: idea }]
  });

  const textBlocks = message.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text);

  return {
    generated: parseGeneratedResponse(textBlocks.join('\n').trim(), platforms),
    model_used: message.model,
    tokens_used: (message.usage?.input_tokens || 0) + (message.usage?.output_tokens || 0)
  };
}

export async function generateContent({
  idea,
  post_type,
  platforms,
  tone,
  language,
  model,
  userId
}) {
  const { openaiKey, groqKey, anthropicKey } = await getProviderKeys(userId);
  const systemPrompt = buildSystemPrompt(post_type, tone, language, platforms);

  if (model === 'openai') {
    return generateWithOpenAI({
      apiKey: openaiKey,
      systemPrompt,
      idea,
      platforms
    });
  }

  if (model === 'groq') {
    return generateWithGroq({
      apiKey: groqKey,
      systemPrompt,
      idea,
      platforms
    });
  }

  if (model === 'anthropic') {
    return generateWithClaude({
      apiKey: anthropicKey,
      systemPrompt,
      idea,
      platforms
    });
  }

  throw new Error(`Unsupported model provider: ${model}`);
}
