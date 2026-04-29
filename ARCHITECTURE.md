# Postly Architecture

## Overview

Postly is a backend system designed for AI-assisted, multi-platform content publishing via a Telegram bot interface.

The system is composed of five core subsystems:

1. Express API server for HTTP endpoints and Telegram webhook intake
2. Telegram Bot for conversational user interaction
3. PostgreSQL (via Prisma) for persistent data storage
4. Redis for ephemeral conversation state and BullMQ queue management
5. AI providers (OpenAI, Groq, Anthropic) for content generation

---

## Why This Architecture

This system is designed to handle:

* conversational user input (Telegram-based UX)
* AI-driven content generation (variable latency)
* multi-platform publishing with unreliable external APIs

To address these:

* Redis is used for fast, short-lived conversational state
* BullMQ decouples publishing from user interaction
* PostgreSQL ensures durable tracking of posts and platform status
* Platform-specific job execution isolates failures

This architecture prioritizes:

* reliability
* failure isolation
* asynchronous execution
* clear observability

---

## Data Flow

```text
Telegram User
   ↓
Telegram Bot
   ↓
API Server (Express)
   ↓
Redis (conversation state)
   ↓
AI Content Engine
   ↓
Post + PlatformPost (DB)
   ↓
BullMQ Queue
   ↓
Worker
   ↓
Platform APIs
```

---

## Main Runtime Flow

1. User initiates `/post` in Telegram
2. Bot retrieves user via `telegram_chat_id`
3. Conversation state stored in Redis (`conv:<chatId>`)
4. User provides:

   * post type
   * platforms
   * tone
   * model
   * idea
5. Bot calls AI content generation service
6. AI returns platform-specific content
7. Preview shown to user
8. On confirmation:

   * Post record created
   * PlatformPost records created
   * Jobs queued per platform
9. Worker processes jobs asynchronously
10. Platform adapters publish content
11. Status updated per platform

---

## Conversation State (Redis)

* Key format: `conv:<chatId>`
* TTL: 30 minutes
* Stored as JSON blob

### Why Redis

* fast read/write for conversational flow
* TTL-based automatic cleanup
* simple state management

### Trade-offs

* state lost after expiry
* no versioning
* dependency on Redis availability

---

## Queue & Publishing Architecture

* BullMQ handles background job processing
* One job per platform
* Retry strategy:

  * 3 attempts
  * exponential backoff (1s → 5s → 25s)

### Job Lifecycle

queued → processing → published / failed

### Why Queue

* external APIs are unreliable
* avoids blocking user flow
* supports retries and scaling

---

## Schema Design

Core models:

* User
* SocialAccount
* AIKey
* Post
* PlatformPost

### Post vs PlatformPost

* Post → user intent
* PlatformPost → per-platform execution

This allows:

* independent retries
* per-platform status tracking
* failure isolation

---

## Failure Handling

The system handles multiple failure scenarios:

* AI failure → generation fails, user notified
* Redis failure → conversation state may be lost
* Queue failure → retry via BullMQ
* Platform failure → isolated per PlatformPost

### Partial Failures

* some platforms may succeed while others fail
* retries occur independently
* parent Post status is derived

Current limitation:

* no explicit `partial_success` state

---

## Scalability Considerations

* API and worker can be separated into independent services
* BullMQ supports horizontal scaling of workers
* Redis handles high-throughput state operations
* PostgreSQL can be optimized with indexing
* platform jobs can be distributed across queues

---

## Deployment Architecture

In production, the system is deployed across managed services:

- API server hosted on Render
- PostgreSQL hosted on Render PostgreSQL
- Redis hosted on Upstash

### Why this setup

- Render simplifies deployment and scaling for Node.js services
- Upstash provides serverless Redis suitable for queue and state
- Separation of services improves reliability and scalability

---

## Security Considerations

* passwords hashed using bcrypt
* JWT authentication with refresh tokens
* tokens encrypted using AES-256-GCM
* secrets stored in environment variables

Future improvements:

* hash refresh tokens
* webhook signature verification
* external secret manager

---

## Key Design Trade-offs

* Bot-first UX vs clean service separation
* Simplicity vs production scalability
* App-managed secrets vs dedicated secret service
* JSON-based AI output vs strict validation

---

## Known Limitations

* no Telegram-native user registration
* no full OAuth flow for social platforms
* Instagram and Threads adapters incomplete
* scheduled posts not fully implemented
* worker and API run in same process
* inconsistent request validation

---

## Summary

Postly transforms a conversational user input into:

* a persistent Post record
* multiple PlatformPost execution units
* asynchronous publishing jobs

This architecture ensures:

* independent platform execution
* retryable job processing
* scalable async design

It is a pragmatic system that balances simplicity and real-world constraints while demonstrating production-oriented design patterns.
