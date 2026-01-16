import request from 'supertest';
import app from '../src/app';
import { PrismaClient } from '@prisma/client';
import { resetDatabase } from './utils/dbReset';

const prisma = new PrismaClient();
let user: any;
let client: any;

beforeAll(async () => {
  await resetDatabase();

  user = await prisma.user.create({
    data: {
      email: `teacher_${Date.now()}@example.com`,
      passwordHash: 'hashed_password',
      fullName: 'Test Teacher',
      role: 'TEACHER',
    },
  });

  client = await prisma.client.create({
    data: {
      fullName: 'Test Client',
      phone: '+79995553322',
      email: `client_${Date.now()}@example.com`,
    },
  });
});

describe('Lessons CRUD', () => {
  it('POST /api/lessons — создаёт занятие', async () => {
    const res = await request(app).post('/api/lessons').send({
      clientId: client.id,
      userId: user.id,
      startTime: new Date(),
      durationMin: 60,
      type: 'consultation',
      status: 'PLANNED',
    });
    expect(res.statusCode).toBe(201);
  });
});
