import request from 'supertest';
import app from '../app.js';
import { prisma } from '../config/db.js';

let token;

beforeAll(async () => {
  await prisma.refreshToken.deleteMany();
  await prisma.platformPost.deleteMany();
  await prisma.post.deleteMany();
  await prisma.socialAccount.deleteMany();
  await prisma.user.deleteMany();
  await request(app).post('/api/auth/register').send({
    email: 'content@test.com', password: 'pass123', name: 'Content'
  });
  const login = await request(app).post('/api/auth/login').send({
    email: 'content@test.com', password: 'pass123'
  });
  token = login.body.data.access_token;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Content Generation', () => {
  it('should reject invalid post_type', async () => {
    const res = await request(app)
      .post('/api/content/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ idea: 'test', post_type: 'invalid', platforms: ['twitter'], tone: 'casual', model: 'groq' });
    expect(res.status).toBe(400);
  });

  it('should reject missing required fields', async () => {
    const res = await request(app)
      .post('/api/content/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ idea: 'test' });
    expect(res.status).toBe(400);
  });
});
