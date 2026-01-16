import request from 'supertest';
import app from '../src/app';
import prisma from '../src/utils/prismaClient';
import { resetDatabase } from './utils/dbReset';
import { User } from '@prisma/client';

describe('Slot Weights CRUD', () => {
  let user: User;

  beforeAll(async () => {
    console.log('Очистка базы данных перед тестами...');
    await resetDatabase();

    user = await prisma.user.create({
      data: {
        email: 'teacher@example.com',
        passwordHash: 'hashed_password',
        fullName: 'Преподаватель Тестович',
        role: 'TEACHER',
      },
    });

    console.log('Пользователь создан для slot weights.');
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('POST /api/slot-weights — создаёт веса', async () => {
    const res = await request(app)
      .post('/api/slot-weights')
      .send({
        userId: user.id,
        wTime: 0.4,
        wCompact: 0.2,
        wWeekday: 0.3,
        wPriority: 0.1,
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.userId).toBe(user.id);
  });

  it('GET /api/slot-weights — возвращает список', async () => {
    const res = await request(app).get('/api/slot-weights');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('PUT /api/slot-weights/:userId — обновляет веса', async () => {
    const res = await request(app)
      .put(`/api/slot-weights/${user.id}`)
      .send({
        wTime: 0.5,
        wCompact: 0.2,
        wWeekday: 0.2,
        wPriority: 0.1,
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.wTime).toBeCloseTo(0.5);
  });

  it('GET /api/slot-weights/:userId — возвращает веса конкретного пользователя', async () => {
    const res = await request(app).get(`/api/slot-weights/${user.id}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.userId).toBe(user.id);
  });
});
