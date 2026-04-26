import express from 'express';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import contentRoutes from './routes/content.js';
import postRoutes from './routes/posts.js';
import dashboardRoutes from './routes/dashboard.js';
import telegramRoutes from './routes/telegram.js';
import { errorHandler } from './middleware/error.js';

const app = express();

// Parse JSON bodies
app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Webhook route for Telegram bot
app.use('/webhook', telegramRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Global error handler (must be last)
app.use(errorHandler);

export default app;