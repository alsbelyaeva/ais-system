import request from 'supertest';
import app from '../src/app';
import prisma from '../src/utils/prismaClient';
import { resetDatabase } from './utils/dbReset';

describe('Clients CRUD', () => {
  let user: any;

  beforeAll(async () => {
    await resetDatabase();

    user = await prisma.user.create({
      data: {
        email: `test_${Date.now()}@example.com`,
        passwordHash: '123',
        fullName: 'Manager',
        role: 'TEACHER',
      },
    });
  });

  it('POST /api/clients — создаёт клиента', async () => {
    const suffix = Date.now();
    const res = await request(app)
      .post('/api/clients')
      .send({
        fullName: 'Test Client',
        phone: `+7999${suffix}`,
        email: `client_${suffix}@example.com`,
        vip: false,
        notes: 'Первый визит',
      });

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('fullName', 'Test Client');
  });

  it('GET /api/clients — возвращает список клиентов', async () => {
    const res = await request(app).get('/api/clients');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('PUT /api/clients/:id — обновляет клиента', async () => {
    const client = await prisma.client.findFirst();
    const res = await request(app)
      .put(`/api/clients/${client?.id}`)
      .send({ fullName: 'Updated Client' });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('fullName', 'Updated Client');
  });

  it('DELETE /api/clients/:id — soft delete', async () => {
    const client = await prisma.client.findFirst();
    const res = await request(app).delete(`/api/clients/${client?.id}`);
    expect(res.statusCode).toBe(200);
  });
});
