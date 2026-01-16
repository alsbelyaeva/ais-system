import { Router } from 'express';
import { getClients, getClientById } from '../controllers/adminClients';
import { authMiddleware, requireRole } from '../middleware/auth';
import { PrismaClient } from '@prisma/client';

// adminRoutes.ts - Добавьте эти маршруты в ваш Express приложение

const router = Router();
const prisma = new PrismaClient();

// Middleware для проверки роли администратора
const isAdmin = async (req: any, res: any, next: any) => {
  try {
    // Предполагается, что у вас есть аутентификация и userId в req.user
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Доступ запрещен. Требуются права администратора' });
    }

    next();
  } catch (error) {
    res.status(500).json({ error: 'Ошибка проверки прав доступа' });
  }
};

// Получить всех клиентов (только для администраторов)
router.get('/api/admin/clients', isAdmin, async (req, res) => {
  try {
    const clients = await prisma.client.findMany({
      where: {
        deletedAt: null,
      },
      include: {
        user: {
          select: {
            fullName: true,
            email: true,
          },
        },
        _count: {
          select: {
            lessons: true,
            payments: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json(clients);
  } catch (error) {
    console.error('Error fetching all clients:', error);
    res.status(500).json({ error: 'Ошибка получения клиентов' });
  }
});

// Получить детальную информацию о клиенте (только для администраторов)
router.get('/api/admin/clients/:id', isAdmin, async (req, res) => {
  try {
    const clientId = parseInt(req.params.id);

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      include: {
        user: {
          select: {
            fullName: true,
            email: true,
          },
        },
        lessons: {
          orderBy: {
            startTime: 'desc',
          },
        },
        payments: {
          orderBy: {
            dateTime: 'desc',
          },
        },
      },
    });

    if (!client) {
      return res.status(404).json({ error: 'Клиент не найден' });
    }

    res.json(client);
  } catch (error) {
    console.error('Error fetching client details:', error);
    res.status(500).json({ error: 'Ошибка получения деталей клиента' });
  }
});

// Обновление статуса занятия
router.patch('/api/lessons/:id', async (req, res) => {
  try {
    const lessonId = parseInt(req.params.id);
    const { status } = req.body;

    // Проверка валидности статуса
    if (!['PLANNED', 'DONE', 'CANCELLED'].includes(status)) {
      return res.status(400).json({ error: 'Неверный статус' });
    }

    const lesson = await prisma.lesson.update({
      where: { id: lessonId },
      data: { status },
      include: {
        client: true,
      },
    });

    // Логирование изменения в audit log
    await prisma.auditLog.create({
      data: {
        userId: req.user?.id || null,
        action: 'UPDATE',
        entity: 'Lesson',
        entityId: lessonId.toString(),
        details: {
          field: 'status',
          newValue: status,
        },
      },
    });

    res.json(lesson);
  } catch (error) {
    console.error('Error updating lesson status:', error);
    res.status(500).json({ error: 'Ошибка обновления статуса занятия' });
  }
});

// Получить статистику по занятиям
router.get('/api/lessons/stats', async (req, res) => {
  try {
    const userId = req.user?.id;
    
    const whereClause = userId ? { userId } : {};

    const [cancelled, done] = await Promise.all([
      prisma.lesson.count({
        where: {
          ...whereClause,
          status: 'CANCELLED',
        },
      }),
      prisma.lesson.count({
        where: {
          ...whereClause,
          status: 'DONE',
        },
      }),
    ]);

    res.json({ cancelled, done });
  } catch (error) {
    console.error('Error fetching lesson stats:', error);
    res.status(500).json({ error: 'Ошибка получения статистики' });
  }
});




// ========================================
// Дополнительные утилиты для интеграции
// ========================================

/*
Инструкции по интеграции:

1. Импортируйте эти маршруты в ваш главный файл приложения (обычно app.ts или server.ts):

   import adminRoutes from './routes/adminRoutes';
   app.use(adminRoutes);

2. Убедитесь, что у вас настроена аутентификация и middleware добавляет информацию 
   о пользователе в req.user

3. Обновите существующий эндпоинт GET /api/lessons, чтобы он возвращал занятия с информацией о клиенте:

   router.get('/api/lessons', async (req, res) => {
     try {
       const userId = req.user?.id;
       const whereClause = userId ? { userId } : {};

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
       console.error('Error fetching lessons:', error);
       res.status(500).json({ error: 'Ошибка получения занятий' });
     }
   });

4. В вашем фронтенд приложении добавьте новый раздел для администраторов:
   - Импортируйте компонент AdminClients
   - Добавьте его в роутинг (например, /admin/clients)
   - Убедитесь, что роут защищен и доступен только администраторам

5. Пример добавления в React Router:

   import AdminClients from './components/AdminClients';
   
   // В вашем роутинге:
   {user?.role === 'ADMIN' && (
     <Route path="/admin/clients" element={<AdminClients />} />
   )}

6. Добавьте ссылку в навигацию для администраторов:

   {user?.role === 'ADMIN' && (
     <Link to="/admin/clients">
       <Users className="w-5 h-5" />
       Все клиенты
     </Link>
   )}
*/

// Только администраторы могут использовать эти маршруты
router.get('/clients', authMiddleware, requireRole(['ADMIN']), getClients);
router.get('/clients/:id', authMiddleware, requireRole(['ADMIN']), getClientById);

export default router;

