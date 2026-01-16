import { Router } from 'express';
import * as ctrl from '../controllers/lessonsController';
import { authMiddleware } from '../middleware/auth';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Применяем middleware авторизации ко всем роутам
router.use(authMiddleware);

// Получить все занятия (с фильтрацией по userId для преподавателей)
router.get('/', async (req, res) => {
  try {
    const user = req.user; 
    
    if (!user) {
      return res.status(401).json({ error: 'Не авторизован' });
    }
    
    // Определяем условие фильтрации в зависимости от роли
    const whereClause = user.role === 'ADMIN' 
      ? {} // Админ видит все занятия
      : { userId: user.id }; // Преподаватель видит только свои

    console.log('🔍 [Lessons] Получение занятий для пользователя:', {
      userId: user.id,
      role: user.role,
      whereClause
    });

    const lessons = await prisma.lesson.findMany({
      where: whereClause,
      include: {
        client: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
      orderBy: {
        startTime: 'asc',
      },
    });

    console.log(`✅ [Lessons] Найдено занятий: ${lessons.length}`);
    res.json(lessons);
  } catch (error) {
    console.error('❌ [Lessons] Error fetching lessons:', error);
    res.status(500).json({ error: 'Failed to fetch lessons' });
  }
});

// Альтернативный роут для API
router.get('/api/lessons', async (req, res) => {
  try {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({ error: 'Не авторизован' });
    }
    
    const whereClause = user.role === 'ADMIN' 
      ? {} 
      : { userId: user.id };

    const lessons = await prisma.lesson.findMany({
      where: whereClause,
      include: {
        client: {
          select: {
            fullName: true,
          },
        },
      },
      orderBy: {
        startTime: 'asc',
      },
    });

    res.json(lessons);
  } catch (error) {
    console.error('❌ [Lessons] Error fetching lessons:', error);
    res.status(500).json({ error: 'Ошибка получения занятий' });
  }
});

// Получить статистику по занятиям (с фильтрацией)
router.get('/stats', async (req, res) => {
  try {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({ error: 'Не авторизован' });
    }
    
    const whereClause = user.role === 'ADMIN' 
      ? {} 
      : { userId: user.id };

    console.log('📊 [Lessons] Получение статистики для:', {
      userId: user.id,
      role: user.role
    });

    const [cancelled, done, planned] = await Promise.all([
      prisma.lesson.count({
        where: { ...whereClause, status: 'CANCELLED' },
      }),
      prisma.lesson.count({
        where: { ...whereClause, status: 'DONE' },
      }),
      prisma.lesson.count({
        where: { ...whereClause, status: 'PLANNED' },
      }),
    ]);

    res.json({
      cancelled,
      done,
      planned,
    });
  } catch (error) {
    console.error('❌ [Lessons] Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Получить конкретное занятие (с проверкой доступа)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    if (!user) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const whereClause = user.role === 'ADMIN'
      ? { id: parseInt(id) }
      : { id: parseInt(id), userId: user.id };

    console.log('🔍 [Lessons] Получение занятия:', {
      lessonId: id,
      userId: user.id,
      role: user.role
    });

    const lesson = await prisma.lesson.findFirst({
      where: whereClause,
      include: {
        client: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });

    if (!lesson) {
      console.log('⚠️ [Lessons] Занятие не найдено или нет доступа');
      return res.status(404).json({ 
        error: 'Lesson not found',
        message: 'Занятие не найдено или у вас нет доступа к нему'
      });
    }

    res.json(lesson);
  } catch (error) {
    console.error('❌ [Lessons] Error fetching lesson:', error);
    res.status(500).json({ error: 'Failed to fetch lesson' });
  }
});

// Создать занятие
router.post('/', async (req, res) => {
  try {
    const { clientId, startTime, durationMin, type, status, notes } = req.body;
    const user = req.user;

    if (!user) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    console.log('➕ [Lessons] Создание занятия:', {
      clientId,
      userId: user.id,
      role: user.role
    });

    // Валидация
    if (!clientId || !startTime || !durationMin || !type) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Заполните все обязательные поля',
      });
    }

    // Проверка существования клиента
    const client = await prisma.client.findUnique({
      where: { id: clientId },
    });

    if (!client) {
      return res.status(404).json({
        error: 'Client not found',
        message: 'Клиент не найден',
      });
    }

    // Создание занятия (автоматически привязываем к текущему пользователю)
    const lesson = await prisma.lesson.create({
      data: {
        clientId,
        startTime: new Date(startTime),
        durationMin,
        type,
        status: status || 'PLANNED',
        notes: notes || null,
        userId: user.id, // Привязываем к текущему пользователю
      },
      include: {
        client: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });

    console.log('✅ [Lessons] Занятие создано:', lesson.id);
    res.status(201).json(lesson);
  } catch (error) {
    console.error('❌ [Lessons] Error creating lesson:', error);
    res.status(500).json({
      error: 'Failed to create lesson',
      message: 'Ошибка при создании занятия',
    });
  }
});
// Проверка доступности времени
router.post('/check-availability', async (req, res) => {
  try {
    const { startTime, durationMin } = req.body;
    const user = req.user;

    if (!user) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    console.log('🔍 [Lessons] Проверка доступности времени:', {
      startTime,
      durationMin,
      userId: user.id,
      role: user.role
    });

    // Валидация
    if (!startTime || !durationMin) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Заполните время и длительность',
      });
    }

    const startTimeDate = new Date(startTime);
    if (isNaN(startTimeDate.getTime())) {
      return res.status(400).json({
        error: 'Invalid date format',
        message: 'Некорректный формат даты',
      });
    }

    const endTimeDate = new Date(startTimeDate.getTime() + durationMin * 60 * 1000);
    
    // Проверяем существующие занятия пользователя
    const existingLessons = await prisma.lesson.findMany({
      where: {
        userId: user.id,
        status: 'PLANNED',
      },
      include: {
        client: {
          select: {
            fullName: true,
          },
        },
      },
    });

    // Проверка на пересечения
    const conflictingLessons = [];
    
    for (const lesson of existingLessons) {
      const lessonStart = new Date(lesson.startTime);
      const lessonEnd = new Date(lessonStart.getTime() + lesson.durationMin * 60 * 1000);
      
      // Проверяем пересечение временных интервалов
      if (startTimeDate < lessonEnd && lessonStart < endTimeDate) {
        conflictingLessons.push({
          id: lesson.id,
          clientName: lesson.client.fullName,
          startTime: lessonStart,
          endTime: lessonEnd,
          duration: lesson.durationMin,
        });
      }
    }

    const isAvailable = conflictingLessons.length === 0;

    console.log('📊 [Lessons] Результат проверки:', {
      isAvailable,
      conflictingLessons: conflictingLessons.length,
      userId: user.id
    });

    res.json({
      available: isAvailable,
      conflictingLessons,
      message: isAvailable 
        ? '✅ Время свободно'
        : `❌ Время занято (${conflictingLessons.length} занятий)`,
    });
  } catch (error) {
    console.error('❌ [Lessons] Error checking availability:', error);
    res.status(500).json({
      error: 'Failed to check availability',
      message: 'Ошибка при проверке доступности времени',
    });
  }
});
// Обновить занятие (с проверкой доступа)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { clientId, startTime, durationMin, type, status, notes } = req.body;
    const user = req.user;

    if (!user) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    console.log('✏️ [Lessons] Обновление занятия:', {
      lessonId: id,
      userId: user.id,
      role: user.role
    });

    // Проверка существования занятия и доступа к нему
    const whereClause = user.role === 'ADMIN'
      ? { id: parseInt(id) }
      : { id: parseInt(id), userId: user.id };

    const existingLesson = await prisma.lesson.findFirst({
      where: whereClause,
    });

    if (!existingLesson) {
      console.log('⚠️ [Lessons] Занятие не найдено или нет доступа');
      return res.status(404).json({
        error: 'Lesson not found',
        message: 'Занятие не найдено или у вас нет доступа к нему',
      });
    }

    // Обновление занятия
    const lesson = await prisma.lesson.update({
      where: { id: parseInt(id) },
      data: {
        clientId,
        startTime: new Date(startTime),
        durationMin,
        type,
        status,
        notes: notes || null,
      },
      include: {
        client: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });

    console.log('✅ [Lessons] Занятие обновлено');
    res.json(lesson);
  } catch (error) {
    console.error('❌ [Lessons] Error updating lesson:', error);
    res.status(500).json({
      error: 'Failed to update lesson',
      message: 'Ошибка при обновлении занятия',
    });
  }
});

// Изменить статус занятия (с проверкой доступа)
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const user = req.user;

    if (!user) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    console.log('🔄 [Lessons] Изменение статуса занятия:', {
      lessonId: id,
      newStatus: status,
      userId: user.id,
      role: user.role
    });

    // Валидация статуса
    const validStatuses = ['PLANNED', 'DONE', 'CANCELLED'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Invalid status',
        message: 'Некорректный статус. Допустимые значения: PLANNED, DONE, CANCELLED',
      });
    }

    // Проверка существования занятия и доступа
    const whereClause = user.role === 'ADMIN'
      ? { id: parseInt(id) }
      : { id: parseInt(id), userId: user.id };

    const existingLesson = await prisma.lesson.findFirst({
      where: whereClause,
    });

    if (!existingLesson) {
      console.log('⚠️ [Lessons] Занятие не найдено или нет доступа');
      return res.status(404).json({
        error: 'Lesson not found',
        message: 'Занятие не найдено или у вас нет доступа к нему',
      });
    }

    // Обновление статуса
    const lesson = await prisma.lesson.update({
      where: { id: parseInt(id) },
      data: {
        status,
        updatedAt: new Date(),
      },
      include: {
        client: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });

    console.log('✅ [Lessons] Статус изменен');
    res.json(lesson);
  } catch (error) {
    console.error('❌ [Lessons] Error updating lesson status:', error);
    res.status(500).json({
      error: 'Failed to update lesson status',
      message: 'Ошибка при изменении статуса занятия',
    });
  }
});

// Удалить занятие (с проверкой доступа)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    if (!user) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    console.log('🗑️ [Lessons] Удаление занятия:', {
      lessonId: id,
      userId: user.id,
      role: user.role
    });

    // Проверка существования занятия и доступа
    const whereClause = user.role === 'ADMIN'
      ? { id: parseInt(id) }
      : { id: parseInt(id), userId: user.id };

    const existingLesson = await prisma.lesson.findFirst({
      where: whereClause,
    });

    if (!existingLesson) {
      console.log('⚠️ [Lessons] Занятие не найдено или нет доступа');
      return res.status(404).json({
        error: 'Lesson not found',
        message: 'Занятие не найдено или у вас нет доступа к нему',
      });
    }

    // Удаление занятия
    await prisma.lesson.delete({
      where: { id: parseInt(id) },
    });

    console.log('✅ [Lessons] Занятие удалено');
    res.json({
      success: true,
      message: 'Занятие успешно удалено',
    });
  } catch (error) {
    console.error('❌ [Lessons] Error deleting lesson:', error);
    res.status(500).json({
      error: 'Failed to delete lesson',
      message: 'Ошибка при удалении занятия',
    });
  }
});

export default router;