import prisma from '../../src/utils/prismaClient';

export async function resetDatabase() {
  console.log('Очистка базы данных перед тестами...');

  // Используем TRUNCATE CASCADE, чтобы снести всё полностью, включая зависимые таблицы
  const tables = [
    '"AuditLog"',
    '"SlotWeight"',
    '"SlotRequest"',
    '"Payment"',
    '"Lesson"',
    '"Client"',
    '"User"',
  ];

  // Удаляем данные каскадно и сбрасываем последовательности ID
  for (const table of tables) {
    try {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE;`);
    } catch (e) {
      console.warn(`Не удалось очистить ${table}:`, e);
    }
  }

  console.log('База данных очищена.');
}
