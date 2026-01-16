import request from 'supertest';
import app from '../src/app';
import prisma from '../src/utils/prismaClient';
import { resetDatabase } from './utils/dbReset';

describe('Audit Logs CRUD', () => {
  let user: any;

  beforeAll(async () => {
    console.log('Очистка базы данных перед тестами...');
    await resetDatabase();

    user = await prisma.user.create({
      data: {
        email: `admin_${Date.now()}@example.com`,
        passwordHash: 'hashed_password',
        fullName: 'Audit Admin',
        role: 'ADMIN',
      },
    });

    console.log('База данных очищена и пользователь создан.');
  });

  it('POST /api/audit-logs — создаёт запись в журнале', async () => {
    const res = await request(app)
      .post('/api/audit-logs')
      .send({
        userId: user.id,
        action: 'create',
        entity: 'Client',
        entityId: '1',
        details: { note: 'Создан новый клиент' },
      });

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.action).toBe('create');
  });

  it('GET /api/audit-logs — возвращает список', async () => {
    const res = await request(app).get('/api/audit-logs');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/audit-logs/:id — возвращает конкретную запись', async () => {
    const createRes = await request(app)
      .post('/api/audit-logs')
      .send({
        userId: user.id,
        action: 'update',
        entity: 'Client',
        entityId: '2',
        details: { changed: 'Имя клиента' },
      });

    const res = await request(app).get(`/api/audit-logs/${createRes.body.id}`);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('id', createRes.body.id);
  });
});
