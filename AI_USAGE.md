# AI Usage

## AI Tools Used During Development

This project was developed with assistance from AI tools including ChatGPT and code assistants.

### Where AI was used

* Initial project structuring (folder layout, service separation)
* JWT authentication and refresh token implementation
* Prisma schema design suggestions
* BullMQ queue setup and retry logic
* Telegram bot conversation flow design
* AI prompt structuring and response parsing
* Drafting README, ARCHITECTURE, and test cases

### Example prompts used

* "Design a Node.js backend with JWT auth and refresh tokens"
* "How to implement BullMQ queue with retries"
* "Telegram bot multi-step conversation flow in Node.js"
* "How to structure Prisma schema for multi-platform posts"
* "How to enforce JSON output from OpenAI"

### What was modified manually

* Refactored generated code into layered architecture (routes → controllers → services → DB)
* Adjusted Prisma schema relationships for Post and PlatformPost
* Implemented platform-specific constraints for generated content
* Improved error handling and fallback logic in AI parsing
* Designed Redis-based conversation state structure
* Integrated queue logic with database persistence
* Fixed edge cases in Telegram bot flow

### Validation approach

* Verified all API endpoints manually via Postman
* Tested Telegram bot flow end-to-end
* Reviewed generated code before integration
* Ensured understanding of each subsystem before finalizing
* Identified and corrected issues in AI-generated code before production use

### Key principle

AI was used as a development accelerator, not as a replacement for understanding.
All major architectural decisions and logic were reviewed and adapted manually.
Some initial scaffolding was generated with AI, but was significantly modified to meet project requirements and improve structure.

---

## Overview

Postly uses AI to generate platform-specific social media content from a single user idea.

The AI layer is implemented in:

* `src/services/content.js`
* `src/routes/content.js`
* `src/bot/handlers.js`
* `src/routes/user.js`

It is used in two places:

1. API-based generation via `POST /api/content/generate`
2. Telegram bot preview generation during `/post` flow

---

## What AI Is Used For

The system uses AI to:

* generate structured, platform-aware content for:

  * Twitter
  * LinkedIn
  * Instagram
  * Threads

The output is structured per platform, not a single generic response.

---

## Supported Providers

* OpenAI
* Groq
* Anthropic

### Model Mapping

* OpenAI → `gpt-4o`
* Groq → `process.env.GROQ_MODEL || "openai/gpt-oss-120b"`
* Anthropic → `claude-3-sonnet-20240229`

### Development note

During development, `OpenAI` and `Anthropic` may require active billing or funded accounts for repeated API use, so Groq with `gpt-oss-120b` was used as the most practical default for testing, debugging, and iteration.

---

## Prompting Strategy

Prompt construction is handled in the AI service.

The system prompt includes:

* post type
* tone
* language
* platforms
* output format (JSON)
* platform-specific constraints

### Platform Rules

* Twitter:

  * max 280 characters
  * 2–3 hashtags
* LinkedIn:

  * 800–1300 characters
  * professional tone
  * 3–5 hashtags
* Instagram:

  * caption + 10–15 hashtags
* Threads:

  * max 500 characters

---

## Output Format

The AI is instructed to return JSON:

```json
{
  "twitter": { "content": "...", "hashtags": [] },
  "linkedin": { "content": "..." },
  "instagram": { "content": "...", "hashtags": [] },
  "threads": { "content": "..." }
}
```

Only requested platforms are returned.

---

## Key Management

AI keys come from:

1. Environment variables
2. User-specific encrypted keys

User keys override environment keys when present.

---

## Response Parsing

The system:

* removes markdown formatting
* parses JSON
* validates required platforms

### Provider Handling

* OpenAI → strict JSON output
* Groq → fallback parsing + text conversion
* Anthropic → text block parsing + JSON conversion

---

## How AI Output Is Used

1. AI generates content
2. Preview shown to user
3. On confirmation:

   * content stored in DB (`PlatformPost`)
4. Queue uses stored content for publishing

Important:

AI is called only once. Publishing uses stored content to ensure consistency.

---

## Token Usage

The system tracks token usage:

* OpenAI → `completion.usage.total_tokens`
* Groq → when available
* Anthropic → input + output tokens

---

## Validation

Input validation ensures:

* valid idea
* valid platforms
* valid tone
* valid model

Telegram bot also restricts invalid input via controlled options.

---

## Design Decisions

### Shared AI Service

* Single `generateContent()` used by both API and bot

### Structured Output

* JSON preferred over free text

### User Keys

* Allows bring-your-own-key usage

---

## Known Limitations

* output normalization is limited
* strict enforcement of platform constraints is incomplete
* malformed responses can cause runtime errors
* Groq output less structured than OpenAI
* no dedicated unit tests for AI provider behavior

---

## Summary

The AI layer powers the core functionality of Postly by generating structured, platform-specific content.

It supports multiple providers, integrates with both API and Telegram flows, and ensures that generated content is persisted before publishing.

The current system is functional and extensible, with future improvements focused on stronger validation, better normalization, and improved provider handling.
