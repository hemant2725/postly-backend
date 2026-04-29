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

1. Clone repo:
   git clone 

2. Install dependencies:
   npm install

3. Setup environment:
   copy .env.example .env

4. Start services:
   docker compose up -d

5. Run migrations:
   npx prisma migrate dev

6. Start server:
   npm run dev

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
* Postman collection

---

## 📜 License

ISC
