import request from 'supertest';
import app from '../app.js';
import { prisma } from '../config/db.js';

beforeAll(async () => {
  await prisma.refreshToken.deleteMany();
  await prisma.platformPost.deleteMany();
  await prisma.post.deleteMany();
  await prisma.socialAccount.deleteMany();
  await prisma.aIKey.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Auth', () => {
  let tokens;

  it('should register a user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@postly.com', password: 'securepass123', name: 'Test' });
    expect(res.status).toBe(201);
    expect(res.body.data.email).toBe('test@postly.com');
  });

  it('should login and return tokens', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@postly.com', password: 'securepass123' });
    expect(res.status).toBe(200);
    expect(res.body.data.access_token).toBeDefined();
    expect(res.body.data.refresh_token).toBeDefined();
    tokens = res.body.data;
  });

  it('should reject protected route without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('should access protected route with valid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${tokens.access_token}`);
    expect(res.status).toBe(200);
  });

  it('should rotate refresh token', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refresh_token: tokens.refresh_token });
    expect(res.status).toBe(200);
    expect(res.body.data.refresh_token).not.toBe(tokens.refresh_token);
  });
});