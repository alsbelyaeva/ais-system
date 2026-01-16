import request from 'supertest';
import app from '../src/app';
import { PrismaClient } from '@prisma/client';
import { resetDatabase } from './utils/dbReset';

const prisma = new PrismaClient();
let user: any;
let client: any;
let lesson: any;

beforeAll(async () => {
  await resetDatabase();

  user = await prisma.user.create({
    data: {
      email: `teacher_${Date.now()}@example.com`,
      passwordHash: 'hashed',
      fullName: 'Teacher Pay',
      role: 'TEACHER',
    },
  });
http://localhost:4000/api/slot-requests
  client = await prisma.client.create({
    data: {
      fullName: 'Client Pay',
      phone: '+70000000000',
      email: `client_pay_${Date.now()}@example.com`,
    },
  });

  lesson = await prisma.lesson.create({
    data: {
      clientId: client.id,
      userId: user.id,
      startTime: new Date(),
      durationMin: 60,
      type: 'consultation',
      status: 'PLANNED',
    },
  });
});

describe('Payments CRUD', () => {
  it('POST /api/payments — создаёт оплату', async () => {
    const res = await request(app).post('/api/payments').send({
      clientId: client.id,
      lessonId: lesson.id,
      amount: 200,
      method: 'cash',
      dateTime: new Date(),
      note: 'Тестовая оплата',
    });
    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('amount', 200);
  });

  it('GET /api/payments — возвращает список', async () => {
    const res = await request(app).get('/api/payments');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
