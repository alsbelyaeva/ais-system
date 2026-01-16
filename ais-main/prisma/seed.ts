import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

async function main() {
  console.log('🧹 Очистка базы данных...');

  await prisma.auditLog.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.lesson.deleteMany();
  await prisma.slotRequest.deleteMany();
  await prisma.client.deleteMany();
  await prisma.slotWeight.deleteMany();
  await prisma.user.deleteMany();

  console.log('👤 Создание пользователей...');

  const admin = await prisma.user.create({
    data: {
      email: 'admin@ais.local',
      passwordHash: await hashPassword('admin123'),
      fullName: 'Администратор системы',
      role: UserRole.ADMIN,
    },
  });

  const teacher1 = await prisma.user.create({
    data: {
      email: 'teacher1@ais.local',
      passwordHash: await hashPassword('teacher123'),
      fullName: 'Анна Иванова',
      role: UserRole.TEACHER,
    },
  });

  const teacher2 = await prisma.user.create({
    data: {
      email: 'teacher2@ais.local',
      passwordHash: await hashPassword('teacher123'),
      fullName: 'Сергей Петров',
      role: UserRole.TEACHER,
    },
  });

  console.log('⚖️ Создание весов ранжирования (SlotWeight)...');

  await prisma.slotWeight.create({
    data: {
      userId: teacher1.id,
      workingDays: [1, 2, 3, 4, 5],
      preferredTimes: {
        morning: { enabled: false, weight: 0.3 },
        day: { enabled: true, weight: 0.7 },
        evening: { enabled: true, weight: 0.8 },
      },
      minGapMinutes: 60,
      maxGapMinutes: 180,
      gapImportance: 0.7,
    },
  });

  await prisma.slotWeight.create({
    data: {
      userId: teacher2.id,
      workingDays: [2, 3, 4, 6],
      preferredTimes: {
        morning: { enabled: true, weight: 0.6 },
        day: { enabled: true, weight: 0.6 },
        evening: { enabled: false, weight: 0.3 },
      },
      minGapMinutes: 30,
      maxGapMinutes: 120,
      gapImportance: 0.5,
    },
  });

  console.log('👥 Создание клиентов...');

  const clientsTeacher1 = await prisma.client.createMany({
    data: [
      {
        fullName: 'Алексей Смирнов',
        email: 'alexey@example.com',
        phone: '+79990000001',
        userId: teacher1.id,
        vip: false,
      },
      {
        fullName: 'Мария Кузнецова',
        email: 'maria@example.com',
        phone: '+79990000002',
        userId: teacher1.id,
        vip: true,
      },
      {
        fullName: 'Илья Воронов',
        email: 'ilya@example.com',
        phone: '+79990000003',
        userId: teacher1.id,
        vip: false,
      },
    ],
  });

  const clientsTeacher2 = await prisma.client.createMany({
    data: [
      {
        fullName: 'Ольга Павлова',
        email: 'olga@example.com',
        phone: '+79990000004',
        userId: teacher2.id,
        vip: false,
      },
      {
        fullName: 'Никита Орлов',
        email: 'nikita@example.com',
        phone: '+79990000005',
        userId: teacher2.id,
        vip: true,
      },
    ],
  });

  console.log('📥 Создание заявок на занятия (SlotRequest)...');

  const clientList = await prisma.client.findMany();

  await prisma.slotRequest.create({
    data: {
      clientId: clientList[0].id,
      proposedSlots: [
        { start: '2026-02-01T09:00:00', duration: 60 },
        { start: '2026-02-01T18:00:00', duration: 60 },
      ],
    },
  });

  await prisma.slotRequest.create({
    data: {
      clientId: clientList[1].id,
      proposedSlots: [
        { start: '2026-02-02T10:00:00', duration: 90 },
        { start: '2026-02-02T16:00:00', duration: 60 },
      ],
    },
  });

  console.log('✅ Сиды успешно загружены');
}

main()
  .catch((e) => {
    console.error('❌ Ошибка сидирования:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
