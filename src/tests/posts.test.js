import request from 'supertest';
import app from '../app.js';
import { prisma } from '../config/db.js';
import { publishQueue } from '../config/queue.js';
import redis from '../config/redis.js';

let token;

beforeAll(async () => {
  await prisma.refreshToken.deleteMany();
  await prisma.platformPost.deleteMany();
  await prisma.post.deleteMany();
  await prisma.user.deleteMany();
  
  await request(app).post('/api/auth/register').send({
    email: 'posts@test.com', password: 'pass123', name: 'Posts'
  });
  const login = await request(app).post('/api/auth/login').send({
    email: 'posts@test.com', password: 'pass123'
  });
  token = login.body.data.access_token;
});

afterAll(async () => {
  await Promise.allSettled([
    publishQueue.close(),
    Promise.resolve(redis.disconnect()),
    prisma.$disconnect(),
  ]);
});

describe('Publishing', () => {
  it('should create post and queue platform jobs', async () => {
    const res = await request(app)
      .post('/api/posts/publish')
      .set('Authorization', `Bearer ${token}`)
      .send({
        idea: 'Launching app',
        post_type: 'announcement',
        platforms: ['linkedin'],
        tone: 'professional',
        language: 'en',
        model: 'groq',
        generated: {
          linkedin: { content: 'Excited to launch...', char_count: 900 }
        }
      });
    expect(res.status).toBe(202);
    expect(res.body.data.post_id).toBeDefined();
  });

  it('should retrieve post with platform statuses from DB', async () => {
    const posts = await prisma.post.findMany({ where: { user_id: (await prisma.user.findUnique({ where: { email: 'posts@test.com' } })).id } });
    expect(posts.length).toBeGreaterThan(0);
  });
});
