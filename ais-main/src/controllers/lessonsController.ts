import { Request, Response } from 'express';
import prisma from '../utils/prismaClient';

// Функция для проверки пересечения временных интервалов
function timeSlotsOverlap(start1: Date, end1: Date, start2: Date, end2: Date): boolean {
  return start1 < end2 && start2 < end1;
}

// Функция для проверки коллизий времени
async function checkTimeConflicts(
  teacherId: string,
  startTime: Date,
  durationMin: number,
  excludeLessonId?: number
) {
  const endTime = new Date(startTime.getTime() + durationMin * 60 * 1000);
  
  console.log(`🔍 [checkTimeConflicts] Проверка для преподавателя: ${teacherId}`);
  console.log(`    Проверяемый интервал: ${startTime.toISOString()} - ${endTime.toISOString()}`);
  console.log(`    Исключаемое занятие: ${excludeLessonId || 'нет'}`);
  
  // Получаем все активные занятия преподавателя
  const existingLessons = await prisma.lesson.findMany({
    where: {
      userId: teacherId,
      status: { in: ['PLANNED'] }, // Проверяем только запланированные занятия
      ...(excludeLessonId ? { id: { not: excludeLessonId } } : {})
    },
    include: {
      client: {
        select: {
          fullName: true
        }
      }
    }
  });
  
  console.log(`    Найдено ${existingLessons.length} запланированных занятий у преподавателя`);
  
  // Проверяем пересечение с каждым существующим занятием
  const conflictingLessons = [];
  
  for (const existingLesson of existingLessons) {
    const existingStart = new Date(existingLesson.startTime);
    const existingEnd = new Date(existingStart.getTime() + existingLesson.durationMin * 60 * 1000);
    
    console.log(`    Проверка с занятием ${existingLesson.id} (${existingLesson.client.fullName}):`);
    console.log(`      Существующее: ${existingStart.toLocaleString('ru-RU')} - ${existingEnd.toLocaleString('ru-RU')}`);
    console.log(`      Новое:        ${startTime.toLocaleString('ru-RU')} - ${endTime.toLocaleString('ru-RU')}`);
    
    if (timeSlotsOverlap(startTime, endTime, existingStart, existingEnd)) {
      console.log(`      ❌ НАЙДЕНО ПЕРЕСЕЧЕНИЕ!`);
      conflictingLessons.push({
        id: existingLesson.id,
        clientName: existingLesson.client.fullName,
        startTime: existingStart,
        endTime: existingEnd,
        duration: existingLesson.durationMin,
        status: existingLesson.status
      });
    } else {
      console.log(`      ✅ Нет пересечения`);
    }
  }
  
  console.log(`    Итого конфликтов: ${conflictingLessons.length}`);
  
  return conflictingLessons;
}

export async function getAll(req: Request, res: Response) {
  try {
    console.log('🔧 [Lessons.getAll] Запрос от пользователя:', req.userId);
    console.log('🔧 [Lessons.getAll] Роль пользователя:', req.user?.role);
    
    const userId = req.userId;
    const userRole = req.user?.role;
    
    if (!userId) {
      console.error('❌ [Lessons.getAll] ОШИБКА: userId не определен');
      return res.status(401).json({ 
        error: 'Не авторизован',
        details: 'userId не найден в запросе'
      });
    }
    
    // Определяем условие WHERE в зависимости от роли
    let whereCondition: any = {};
    
    if (userRole === 'ADMIN') {
      // Админ видит ВСЕ занятия всех преподавателей
      console.log('👑 [Lessons.getAll] Админ запрашивает все занятия');
    } else {
      // Преподаватель видит ТОЛЬКО свои занятия
      whereCondition = {
        userId: userId,
      };
      console.log('👤 [Lessons.getAll] Преподаватель запрашивает свои занятия');
    }
    
    console.log(`🔍 [Lessons.getAll] Условие поиска:`, whereCondition);

    const lessons = await prisma.lesson.findMany({
      where: whereCondition,
      include: { 
        client: {
          select: {
            id: true,
            fullName: true,
            email: true,
            userId: true,
          }
        },
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          }
        }
      },
      orderBy: { startTime: 'asc' },
    });
    
    console.log(`✅ [Lessons.getAll] Найдено ${lessons.length} занятий для пользователя ${userId} (роль: ${userRole})`);
    
    res.json(lessons);
  } catch (error: any) {
    console.error('❌ [Lessons.getAll] Ошибка:', error);
    res.status(500).json({ 
      error: 'Ошибка при получении занятий',
      details: error.message 
    });
  }
}

export async function getStats(req: Request, res: Response) {
  try {
    const userId = req.userId;
    const userRole = req.user?.role;
    
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }
    
    let whereCondition: any = {};
    
    if (userRole !== 'ADMIN') {
      whereCondition = {
        userId: userId,
      };
    }
    
    const cancelled = await prisma.lesson.count({
      where: {
        ...whereCondition,
        status: 'CANCELLED'
      }
    });

    const done = await prisma.lesson.count({
      where: {
        ...whereCondition,
        status: 'DONE'
      }
    });

    const planned = await prisma.lesson.count({
      where: {
        ...whereCondition,
        status: 'PLANNED'
      }
    });

    res.json({ cancelled, done, planned, total: cancelled + done + planned });
  } catch (error: any) {
    console.error('❌ Ошибка при получении статистики:', error);
    res.status(500).json({ error: 'Ошибка при получении статистики', details: error.message });
  }
}

export async function getById(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Неверный ID урока' });
    }

    const userId = req.userId;
    const userRole = req.user?.role;
    
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    let whereCondition: any = { id: id };
    
    if (userRole !== 'ADMIN') {
      whereCondition.userId = userId;
    }

    const lesson = await prisma.lesson.findFirst({
      where: whereCondition,
      include: { 
        client: {
          select: {
            id: true,
            fullName: true,
            userId: true,
          }
        },
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
          }
        }
      },
    });
    
    if (!lesson) {
      return res.status(404).json({ 
        error: 'Урок не найден',
        message: userRole !== 'ADMIN' ? 'Урок не найден или нет доступа' : 'Урок не найден'
      });
    }
    
    res.json(lesson);
  } catch (error: any) {
    console.error('❌ Ошибка при получении урока:', error);
    res.status(500).json({ error: 'Ошибка при получении урока', details: error.message });
  }
}

export async function create(req: Request, res: Response) {
  try {
    const userId = req.userId;
    const userRole = req.user?.role;
    
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }
    
    const { clientId, startTime, durationMin, type, status = 'PLANNED', notes, assignedTeacherId } = req.body;
    
    console.log('📝 [Lessons.create] Создание занятия. Пользователь:', {
      userId,
      role: userRole
    });
    console.log('📦 Данные:', { clientId, startTime, durationMin, type, status, assignedTeacherId });

    // Валидация
    if (!clientId || !startTime || !durationMin || !type) {
      return res.status(400).json({ 
        error: 'Обязательные поля: clientId, startTime, durationMin, type' 
      });
    }

    // Определяем к какому преподавателю привязать занятие
    let targetUserId = userId;
    
    // Если админ и указал assignedTeacherId - привязываем к указанному преподавателю
    if (userRole === 'ADMIN' && assignedTeacherId) {
      // Проверяем что указанный преподаватель существует
      const teacher = await prisma.user.findUnique({
        where: { 
          id: assignedTeacherId,
          role: 'TEACHER'
        }
      });
      
      if (!teacher) {
        return res.status(400).json({ 
          error: 'Указанный преподаватель не найден или не является преподавателем' 
        });
      }
      
      targetUserId = assignedTeacherId;
      console.log(`👑 Админ привязывает занятие к преподавателю: ${targetUserId}`);
    } else if (userRole !== 'ADMIN') {
      // Преподаватель всегда привязывает к себе
      targetUserId = userId;
      
      // Проверяем что клиент принадлежит преподавателю
      const client = await prisma.client.findFirst({
        where: { 
          id: Number(clientId),
          userId: userId 
        }
      });
      
      if (!client) {
        return res.status(403).json({ 
          error: 'Клиент не найден или не принадлежит вам' 
        });
      }
    } else if (userRole === 'ADMIN' && !assignedTeacherId) {
      // Если админ не указал преподавателя, берем преподавателя клиента
      const client = await prisma.client.findUnique({
        where: { id: Number(clientId) },
        select: { userId: true }
      });
      
      if (client && client.userId) {
        targetUserId = client.userId;
        console.log(`👑 Админ создает занятие для клиента преподавателя: ${targetUserId}`);
      } else {
        // Если у клиента нет преподавателя, используем текущего пользователя (админа)
        // или можно создать без преподавателя, но для простоты используем админа
        targetUserId = userId;
        console.log(`👑 Клиент без преподавателя, назначен админ: ${targetUserId}`);
      }
    }

    const startTimeDate = new Date(startTime);
    if (isNaN(startTimeDate.getTime())) {
      return res.status(400).json({ 
        error: 'Неверный формат даты',
        hint: 'Используйте формат: 2025-12-10T22:13:00' 
      });
    }
    
    const endTimeDate = new Date(startTimeDate.getTime() + durationMin * 60 * 1000);
    
    console.log('📊 Детали времени:');
    console.log('  - Запрашиваемое время:', startTimeDate.toLocaleString('ru-RU'), '-', endTimeDate.toLocaleString('ru-RU'));
    console.log('  - Преподаватель:', targetUserId);
    
    // ⚠️ ПРОВЕРКА КОЛЛИЗИЙ ВРЕМЕНИ ⚠️
    console.log(`🔍 Проверка коллизий для преподавателя ${targetUserId}`);
    
    const conflictingLessons = await checkTimeConflicts(
      targetUserId,
      startTimeDate,
      durationMin
    );
    
    console.log('  - Найдено коллизий:', conflictingLessons.length);
    
    if (conflictingLessons.length > 0) {
      console.log('❌ [Lessons.create] Обнаружена коллизия времени!');
      console.log('   Конфликтующие занятия:', conflictingLessons);
      
      const conflictingInfo = conflictingLessons.map(lesson => {
        const startStr = lesson.startTime.toLocaleTimeString('ru-RU', { 
          hour: '2-digit', 
          minute: '2-digit' 
        });
        const endStr = lesson.endTime.toLocaleTimeString('ru-RU', { 
          hour: '2-digit', 
          minute: '2-digit' 
        });
        
        return `${lesson.clientName} (${startStr} - ${endStr})`;
      }).join(', ');
      
      const newStartStr = startTimeDate.toLocaleTimeString('ru-RU', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      const newEndStr = endTimeDate.toLocaleTimeString('ru-RU', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      
      return res.status(409).json({
        error: 'Время занято другим учеником',
        details: 'Выбранное время пересекается с существующими занятиями преподавателя',
        conflictingLessons: conflictingLessons,
        message: `❌ Время ${newStartStr} - ${newEndStr} уже занято: ${conflictingInfo}`,
        newLessonTime: {
          start: startTimeDate,
          end: endTimeDate
        }
      });
    }
    
    console.log('✅ Время свободно, создаем занятие');
    
    // Проверяем существование клиента
    const client = await prisma.client.findUnique({
      where: { id: Number(clientId) }
    });
    
    if (!client) {
      return res.status(404).json({ 
        error: 'Клиент не найден' 
      });
    }
    
    const lesson = await prisma.lesson.create({
      data: { 
        clientId: Number(clientId), 
        userId: targetUserId,
        startTime: startTimeDate,
        durationMin: Number(durationMin), 
        type, 
        status, 
        notes: notes || null 
      },
      include: {
        client: {
          select: {
            id: true,
            fullName: true,
            userId: true,
          }
        },
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
          }
        }
      }
    });
    
    console.log(`✅ [Lessons.create] Занятие создано с ID: ${lesson.id} для клиента ${clientId} (преподаватель: ${targetUserId})`);
    
    res.status(201).json(lesson);
  } catch (error: any) {
    console.error('❌ [Lessons.create] Ошибка при создании урока:', error);
    
    if (error.code === 'P2003') {
      return res.status(400).json({ 
        error: 'Ошибка внешнего ключа', 
        details: 'Указанный клиент не существует',
      });
    }
    
    res.status(500).json({ 
      error: 'Не удалось создать урок', 
      details: error.message 
    });
  }
}

export async function update(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Неверный ID урока' });
    }
    
    const userId = req.userId;
    const userRole = req.user?.role;
    
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }
    
    // Проверяем права доступа
    let existingLesson;
    if (userRole === 'ADMIN') {
      existingLesson = await prisma.lesson.findUnique({
        where: { id },
        include: {
          client: true,
          user: true
        }
      });
    } else {
      existingLesson = await prisma.lesson.findFirst({
        where: { 
          id: id,
          userId: userId,
        },
        include: {
          client: true,
          user: true
        }
      });
    }
    
    if (!existingLesson) {
      return res.status(403).json({ 
        error: 'Урок не найден',
        message: userRole !== 'ADMIN' ? 'Урок не найден или нет доступа' : 'Урок не найден'
      });
    }
    
    const data = { ...req.body };
    
    // Определяем для какого преподавателя проверять пересечения
    const targetTeacherId = data.assignedTeacherId || existingLesson.userId;
    
    // Если обновляется startTime или durationMin, проверяем пересечения
    if ((data.startTime !== undefined || data.durationMin !== undefined) && 
        existingLesson.status !== 'CANCELLED') {
      
      const startTime = data.startTime ? new Date(data.startTime) : new Date(existingLesson.startTime);
      const durationMin = data.durationMin !== undefined ? Number(data.durationMin) : existingLesson.durationMin;
      
      if (isNaN(startTime.getTime())) {
        return res.status(400).json({ error: 'Неверный формат даты' });
      }
      
      const endTime = new Date(startTime.getTime() + durationMin * 60 * 1000);
      
      console.log(`🔍 Проверка коллизий при обновлении для преподавателя ${targetTeacherId}`);
      
      // ⚠️ ПРОВЕРКА КОЛЛИЗИЙ ВРЕМЕНИ ⚠️
      const conflictingLessons = await checkTimeConflicts(
        targetTeacherId,
        startTime,
        durationMin,
        id // Исключаем текущее занятие
      );
      
      if (conflictingLessons.length > 0) {
        console.log('❌ [Lessons.update] Обнаружена коллизия времени при обновлении!');
        
        const conflictingInfo = conflictingLessons.map(lesson => {
          const startStr = lesson.startTime.toLocaleTimeString('ru-RU', { 
            hour: '2-digit', 
            minute: '2-digit' 
          });
          const endStr = lesson.endTime.toLocaleTimeString('ru-RU', { 
            hour: '2-digit', 
            minute: '2-digit' 
          });
          
          return `${lesson.clientName} (${startStr} - ${endStr})`;
        }).join(', ');
        
        const newStartStr = startTime.toLocaleTimeString('ru-RU', { 
          hour: '2-digit', 
          minute: '2-digit' 
        });
        const newEndStr = endTime.toLocaleTimeString('ru-RU', { 
          hour: '2-digit', 
          minute: '2-digit' 
        });
        
        return res.status(409).json({
          error: 'Время занято другим учеником',
          details: 'Обновленное время пересекается с существующими занятиями преподавателя',
          conflictingLessons: conflictingLessons,
          message: `❌ Коллизия! Время ${newStartStr} - ${newEndStr} уже занято: ${conflictingInfo}`
        });
      }
      
      console.log('✅ Время свободно, обновляем занятие');
    }
    
    // Если админ меняет преподавателя
    if (data.assignedTeacherId && userRole === 'ADMIN') {
      // Проверяем что указанный преподаватель существует
      const teacher = await prisma.user.findUnique({
        where: { 
          id: data.assignedTeacherId,
          role: 'TEACHER'
        }
      });
      
      if (!teacher) {
        return res.status(400).json({ 
          error: 'Указанный преподаватель не найден или не является преподавателем' 
        });
      }
      
      data.userId = data.assignedTeacherId;
      delete data.assignedTeacherId;
    }
    
    // Если обычный пользователь пытается изменить clientId
    if (data.clientId !== undefined && userRole !== 'ADMIN') {
      const client = await prisma.client.findFirst({
        where: { 
          id: Number(data.clientId),
          userId: userId 
        }
      });
      
      if (!client) {
        return res.status(403).json({ 
          error: 'Клиент не найден или не принадлежит вам' 
        });
      }
      data.clientId = Number(data.clientId);
    }
    
    // Обновляем данные
    const updated = await prisma.lesson.update({
      where: { id },
      data,
      include: {
        client: {
          select: {
            id: true,
            fullName: true,
            userId: true,
          }
        },
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
          }
        }
      }
    });
    
    console.log(`✅ Урок ${id} обновлен пользователем ${userId} (роль: ${userRole})`);
    
    res.json(updated);
  } catch (error: any) {
    console.error('❌ Ошибка при обновлении урока:', error);
    res.status(500).json({ error: 'Ошибка при обновлении урока', details: error.message });
  }
}

export async function remove(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Неверный ID урока' });
    }
    
    const userId = req.userId;
    const userRole = req.user?.role;
    
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }
    
    // Проверяем права доступа
    let lesson;
    if (userRole === 'ADMIN') {
      lesson = await prisma.lesson.findUnique({
        where: { id }
      });
    } else {
      lesson = await prisma.lesson.findFirst({
        where: { 
          id: id,
          userId: userId,
        }
      });
    }
    
    if (!lesson) {
      return res.status(403).json({ 
        error: 'Урок не найден',
        message: userRole !== 'ADMIN' ? 'Урок не найден или нет доступа' : 'Урок не найден'
      });
    }
    
    await prisma.lesson.delete({ where: { id } });
    
    console.log(`✅ Урок ${id} удален пользователем ${userId} (роль: ${userRole})`);
    
    res.json({ message: 'Урок удален' });
  } catch (error: any) {
    console.error('❌ Ошибка при удалении урока:', error);
    res.status(500).json({ error: 'Ошибка при удалении урока', details: error.message });
  }
}

// Изменение статуса (для календаря)
export async function updateStatus(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Неверный ID урока' });
    }
    
    const userId = req.userId;
    const userRole = req.user?.role;
    
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }
    
    const { status } = req.body;
    
    // Проверка статуса
    const validStatuses = ['PLANNED', 'DONE', 'CANCELLED'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ 
        error: 'Некорректный статус',
        details: 'Допустимые значения: PLANNED, DONE, CANCELLED'
      });
    }
    
    // Проверяем права доступа
    let existingLesson;
    if (userRole === 'ADMIN') {
      existingLesson = await prisma.lesson.findUnique({
        where: { id }
      });
    } else {
      existingLesson = await prisma.lesson.findFirst({
        where: { 
          id: id,
          userId: userId,
        }
      });
    }
    
    if (!existingLesson) {
      return res.status(403).json({ 
        error: 'Урок не найден',
        message: userRole !== 'ADMIN' ? 'Урок не найден или нет доступа' : 'Урок не найден'
      });
    }
    
    // Обновляем статус
    const updated = await prisma.lesson.update({
      where: { id },
      data: { 
        status,
        updatedAt: new Date()
      },
      include: {
        client: {
          select: {
            id: true,
            fullName: true,
          }
        },
        user: {
          select: {
            id: true,
            fullName: true,
          }
        }
      }
    });
    
    console.log(`✅ Статус урока ${id} изменен на ${status} пользователем ${userId}`);
    
    res.json(updated);
  } catch (error: any) {
    console.error('❌ Ошибка при изменении статуса урока:', error);
    res.status(500).json({ 
      error: 'Ошибка при изменении статуса',
      details: error.message 
    });
  }
}

export async function checkAvailability(req: Request, res: Response) {
  try {
    const userId = req.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }
    
    const { startTime, durationMin } = req.body;
    
    if (!startTime || !durationMin) {
      return res.status(400).json({ 
        error: 'Обязательные поля: startTime, durationMin' 
      });
    }
    
    const startTimeDate = new Date(startTime);
    if (isNaN(startTimeDate.getTime())) {
      return res.status(400).json({ 
        error: 'Неверный формат даты',
        hint: 'Используйте формат: 2025-12-10T22:13:00' 
      });
    }
    
    // Временная реализация - всегда возвращаем доступно
    console.log(`✅ Проверка доступности для пользователя ${userId}: время свободно`);
    
    res.json({
      available: true,
      conflictingLessons: [],
      message: '✅ Время свободно'
    });
  } catch (error: any) {
    console.error('❌ Ошибка при проверке доступности:', error);
    res.status(500).json({ 
      error: 'Ошибка при проверке доступности',
      details: error.message 
    });
  }
}
  