# Postly Backend

Postly is a backend system for AI-assisted, multi-platform social media publishing via a Telegram bot.

It allows users to generate platform-specific content from a single idea and publish it asynchronously using a queue-based architecture.

---

## 🌐 Live API

### Infrastructure

- Backend (Node.js + Express) → Render
- PostgreSQL → Render PostgreSQL
- Redis (BullMQ + bot state) → Upstash

Base URL:
https://postly-backend-5bru.onrender.com

Health Check:
GET /health → https://postly-backend-5bru.onrender.com/health

---

## ⚡ Quick Start (2-Min Demo)

1. Import Postman collection (`postly-collection.json`)
2. Register user:
   POST /api/auth/register
3. Add social account:
   POST /api/user/social-accounts
4. Open Telegram bot
5. Run:
   /link email password
   /post
6. Enter idea → preview → confirm → publish

⚠️ Note:
If registration fails with "User already exists",
please use a unique email like:

test+1@gmail.com
test123@gmail.com

---

## 🎥 Demo Video

This video demonstrates the complete end-to-end flow:

* User registration and authentication
* Telegram bot interaction
* AI content generation
* Queue-based publishing
* Platform post status tracking

👉 https://www.loom.com/share/869f322f4e484fcc8ae70b31644e27dc

---

## 📦 Tech Stack

* Node.js + Express
* PostgreSQL + Prisma
* Redis + BullMQ
* Telegram Bot API
* Groq + OpenAI + Anthropic APIs (used Groq )

Note:
`OpenAI` and `Anthropic` may require active billing or funded accounts for repeated API use during development, so Groq with the `gpt-oss-120b` model was used as the most practical default for testing and iteration.

---

## 🧠 What It Does

* User authentication (JWT + refresh tokens)
* Telegram-based content creation flow
* AI-powered content generation
* Multi-platform publishing (Twitter, LinkedIn, etc.)
* Queue-based async job processing
* Post status tracking per platform

---

## 🏗️ Architecture Overview

Flow:

User → Telegram Bot → API Server → AI Engine → Queue → Platform APIs → Database

Core components:

* Express API (routes, controllers, services)
* Redis (bot state + queues)
* BullMQ (job processing)
* PostgreSQL (persistent storage)

---

## 📁 Project Structure

src/
routes/
controllers/
services/
middleware/
jobs/
bot/
config/
utils/

---

## 🔐 Authentication & Security

* Passwords hashed using bcrypt
* JWT access tokens (short-lived)
* Refresh tokens stored in DB and rotated
* Sensitive tokens encrypted (AES-256)

---

## 🤖 Telegram Bot

### Commands:

* /start → begin flow
* /post → create post
* /status → last posts
* /accounts → connected accounts
* /link email password → link account
* /help → show commands

### Flow:

1. Start bot
2. Link account
3. Choose post type
4. Select platform
5. Choose tone
6. Select model
7. Enter idea
8. Review generated content
9. Confirm and publish

---

## 📡 API Overview

### Auth

* POST /api/auth/register
* POST /api/auth/login
* POST /api/auth/refresh
* POST /api/auth/logout
* GET /api/auth/me

### User

* GET /api/user/profile
* PUT /api/user/profile
* POST /api/user/social-accounts
* GET /api/user/social-accounts

### Content

* POST /api/content/generate

### Posts

* POST /api/posts/publish
* GET /api/posts
* GET /api/posts/

### Dashboard

* GET /api/dashboard/stats

---

## ⚙️ Local Setup

### Prerequisites

Install these before starting:

* Node.js 18+
* npm
* Docker Desktop
* Telegram bot token from BotFather
* Groq API key for local AI generation

### 1. Clone the repository

```bash
git clone https://github.com/hemant2725/postly-backend.git
cd postly-backend
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create local environment file

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

macOS/Linux:

```bash
cp .env.example .env
```

Update `.env` for local development:

```env
NODE_ENV=development
PORT=3000

DATABASE_URL=postgresql://postgres:password@localhost:5432/postly
REDIS_URL=redis://localhost:6379

JWT_SECRET=replace-with-a-long-random-access-token-secret
JWT_REFRESH_SECRET=replace-with-a-different-long-random-refresh-secret
ENCRYPTION_KEY=replace-with-a-long-random-encryption-secret

TELEGRAM_BOT_TOKEN=your-telegram-bot-token
GROQ_API_KEY=your-groq-api-key

# Optional locally. Required only in production webhook mode.
WEBHOOK_URL=
```

Local mode uses Telegram polling, so no public HTTPS webhook URL is required.

### 4. Start Postgres and Redis

```bash
docker compose up -d
```

This starts:

* PostgreSQL on `localhost:5432`
* Redis on `localhost:6379`

### 5. Run database migrations

```bash
npx prisma migrate dev
```

Optional: open Prisma Studio to inspect local data:

```bash
npx prisma studio
```

### 6. Start the backend

```bash
npm run dev
```

The API runs at:

```txt
http://localhost:3000
```

Health check:

```txt
GET http://localhost:3000/health
```

### 7. Test the local flow

1. Import `postly-collection.json` into Postman
2. Register a user with `POST /api/auth/register`
3. Add a social account with `POST /api/user/social-accounts`
4. Open your Telegram bot
5. Link your account:

```txt
/link your@email.com yourpassword
```

6. Start creating a post:

```txt
/post
```

### 8. Run tests

```bash
npm test
```

On Windows PowerShell, if `npm.ps1` is blocked by execution policy, run:

```powershell
cmd /c npm test
```

### Local vs Production Telegram Mode

Local development:

* `NODE_ENV=development`
* Bot uses polling
* No `WEBHOOK_URL` needed

Production on Render:

* `NODE_ENV=production`
* Bot uses Telegram webhook
* `WEBHOOK_URL` must be a public HTTPS URL
* Telegram sends updates to `/webhook/telegram`

---

## 🧪 Testing

Run:
npm test

Covers:

* auth
* middleware
* post creation
* queue jobs

---

## 📄 Environment Variables

See `.env.example`

Important variables:

* DATABASE_URL → PostgreSQL connection string required for all database operations
* REDIS_URL → Required for queues (BullMQ) and Telegram bot state management
* JWT_SECRET → Used to sign access tokens (must be secure and at least 32 characters)
* TELEGRAM_BOT_TOKEN → Required for Telegram bot functionality
* OPENAI_API_KEY → Used for AI content generation when user-specific keys are not provided

---

## ⚠️ Known Limitations

* No Telegram-native registration yet
* OAuth flow not fully implemented
* Instagram & Threads not complete
* Some publishing adapters mocked

---

## 🚀 Future Improvements

* Telegram-based signup
* Full OAuth integration
* Scheduled posts (delayed queue)
* Improved error handling
* Complete platform integrations

---

## 📚 Documentation

* ARCHITECTURE.md
* AI_USAGE.md

---

## 📜 License

ISC
