import request from 'supertest';
import app from '../src/app';
import prisma from '../src/utils/prismaClient';
import { resetDatabase } from './utils/dbReset';

describe('Users CRUD', () => {
  beforeAll(async () => {
    await resetDatabase();
  });

  it('POST /api/users — создаёт пользователя', async () => {
    const email = `user_${Date.now()}@example.com`;
    const res = await request(app)
      .post('/api/users')
      .send({
        email,
        passwordHash: 'secure_hash',
        fullName: 'New User',
        role: 'TEACHER',
      });

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('email', email);
  });

  it('GET /api/users — возвращает список пользователей', async () => {
    const res = await request(app).get('/api/users');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /api/users — отклоняет дублирующий email', async () => {
    const email = `duplicate_${Date.now()}@example.com`;

    await prisma.user.create({
      data: {
        email,
        passwordHash: 'hashed',
        fullName: 'Duplicate',
        role: 'TEACHER',
      },
    });

    const res = await request(app)
      .post('/api/users')
      .send({
        email,
        passwordHash: 'another_hash',
        fullName: 'Duplicate2',
        role: 'ADMIN',
      });

    expect(res.statusCode).toBe(400);
  });
});
