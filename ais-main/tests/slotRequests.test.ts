import request from 'supertest';
import app from '../src/app';
import { PrismaClient } from '@prisma/client';
import { resetDatabase } from './utils/dbReset';

const prisma = new PrismaClient();
let client: any;

beforeAll(async () => {
  await resetDatabase();
  client = await prisma.client.create({
    data: {
      fullName: 'Client SR',
      phone: '+79998887766',
      email: `client_sr_${Date.now()}@example.com`,
    },
  });
  console.log('Клиент создан для slot requests.');
});

describe('Slot Requests CRUD', () => {
  it('POST /api/slot-requests — создаёт запрос', async () => {
    const res = await request(app).post('/api/slot-requests').send({
      clientId: client.id,
      proposedSlots: [
        { date_time: new Date().toISOString(), duration: 60 },
      ],
      status: 'pending',
    });
    expect(res.statusCode).toBe(201);
  });
});
