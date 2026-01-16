import { Request, Response } from 'express';
import prisma from '../utils/prismaClient';

// Создать оплату
export const create = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    const userRole = req.user?.role;
    
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }
    
    const data = {
      ...req.body,
      amount: Number(req.body.amount),
      dateTime: new Date(req.body.dateTime || new Date()),
    };

    // Проверяем существование клиента
    const client = await prisma.client.findUnique({
      where: { id: data.clientId },
      select: {
        id: true,
        userId: true,
        fullName: true
      }
    });

    if (!client) {
      return res.status(404).json({ error: 'Клиент не найден' });
    }

    // АДМИН МОЖЕТ СОЗДАВАТЬ ПЛАТЕЖИ ДЛЯ ЛЮБОГО КЛИЕНТА
    // Преподаватель - только для своих клиентов
    if (userRole !== 'ADMIN' && client.userId !== userId) {
      return res.status(403).json({ 
        error: 'Доступ запрещен',
        message: 'Клиент не принадлежит вам' 
      });
    }

    // Проверяем lessonId если он указан
    if (data.lessonId) {
      const lesson = await prisma.lesson.findUnique({
        where: { id: data.lessonId },
        select: {
          id: true,
          userId: true
        }
      });
      
      if (!lesson) {
        return res.status(404).json({ error: 'Урок не найден' });
      }
      
      // Преподаватель может создавать платежи только для своих уроков
      if (userRole !== 'ADMIN' && lesson.userId !== userId) {
        return res.status(403).json({ 
          error: 'Доступ запрещен',
          message: 'Урок не принадлежит вам' 
        });
      }
    }

    const payment = await prisma.payment.create({ 
      data,
      include: { 
        client: {
          select: {
            id: true,
            fullName: true,
            userId: true,
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
              }
            }
          }
        },
        lesson: {
          select: {
            id: true,
            startTime: true,
            type: true,
            userId: true
          }
        }
      }
    });
    
    console.log(`✅ Платеж создан: ${payment.id} для клиента ${client.fullName} (создатель: ${userId}, роль: ${userRole})`);
    
    res.status(201).json({ 
      ...payment, 
      amount: Number(payment.amount)
    });
  } catch (err: any) {
    console.error('❌ Ошибка при создании оплаты:', err);
    
    // Обработка ошибок Prisma
    if (err.code === 'P2003') {
      return res.status(400).json({ error: 'Клиент с указанным ID не существует' });
    }
    
    res.status(500).json({ error: 'Не удалось создать оплату', details: err.message });
  }
};

// Получить все оплаты
export const getAll = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    const userRole = req.user?.role;
    
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }
    
    let whereCondition: any = {
      client: {
        deletedAt: null
      }
    };
    
    // АДМИН ВИДИТ ВСЕ ПЛАТЕЖИ
    // Преподаватель видит только платежи своих клиентов
    if (userRole !== 'ADMIN') {
      whereCondition.client.userId = userId;
    }
    
    console.log(`🔍 [Payments.getAll] Получение платежей для ${userRole === 'ADMIN' ? 'всех клиентов' : 'клиентов преподавателя'}`);
    
    const payments = await prisma.payment.findMany({
      where: whereCondition,
      include: {
        client: {
          select: {
            id: true,
            fullName: true,
            userId: true,
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
              }
            }
          }
        },
        lesson: {
          select: {
            id: true,
            startTime: true,
            type: true
          }
        }
      },
      orderBy: {
        dateTime: 'desc'
      }
    });
    
    // Форматируем ответ
    const formattedPayments = payments.map(payment => ({
      ...payment,
      amount: Number(payment.amount)
    }));
    
    console.log(`✅ Получено ${formattedPayments.length} платежей для пользователя ${userId} (роль: ${userRole})`);
    
    res.status(200).json(formattedPayments);
  } catch (err: any) {
    console.error('❌ Ошибка при получении платежей:', err);
    res.status(500).json({ error: 'Не удалось получить список оплат', details: err.message });
  }
};

// Получить оплату по ID
export const getById = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Неверный ID платежа' });
    }

    const userId = req.userId;
    const userRole = req.user?.role;
    
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        client: {
          select: {
            id: true,
            fullName: true,
            userId: true,
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
              }
            }
          }
        },
        lesson: {
          select: {
            id: true,
            startTime: true,
            type: true
          }
        }
      }
    });
    
    if (!payment) {
      return res.status(404).json({ error: 'Оплата не найдена' });
    }
    
    // АДМИН МОЖЕТ ВИДЕТЬ ЛЮБОЙ ПЛАТЕЖ
    // Преподаватель может видеть только платежи своих клиентов
    if (userRole !== 'ADMIN' && payment.client.userId !== userId) {
      return res.status(403).json({ 
        error: 'Доступ запрещен',
        message: 'Этот платеж не принадлежит вашему клиенту'
      });
    }
    
    res.status(200).json({
      ...payment,
      amount: Number(payment.amount)
    });
  } catch (err: any) {
    console.error('❌ Ошибка при поиске оплаты:', err);
    res.status(500).json({ error: 'Ошибка при поиске оплаты', details: err.message });
  }
};

// Обновление оплаты
export const update = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Неверный ID платежа' });
    }

    const userId = req.userId;
    const userRole = req.user?.role;
    
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    // Проверяем существование платежа
    const existingPayment = await prisma.payment.findUnique({
      where: { id },
      include: {
        client: {
          select: {
            userId: true
          }
        }
      }
    });

    if (!existingPayment) {
      return res.status(404).json({ error: 'Оплата не найдена' });
    }

    // АДМИН МОЖЕТ ОБНОВЛЯТЬ ЛЮБОЙ ПЛАТЕЖ
    // Преподаватель может обновлять только платежи своих клиентов
    if (userRole !== 'ADMIN' && existingPayment.client.userId !== userId) {
      return res.status(403).json({ 
        error: 'Доступ запрещен',
        message: 'Этот платеж не принадлежит вашему клиенту'
      });
    }

    const updateData: any = {};
    
    if (req.body.amount !== undefined) {
      updateData.amount = Number(req.body.amount);
    }
    if (req.body.dateTime !== undefined) {
      updateData.dateTime = new Date(req.body.dateTime);
    }
    if (req.body.method !== undefined) {
      updateData.method = req.body.method;
    }
    if (req.body.notes !== undefined) {
      updateData.notes = req.body.notes;
    }

    const updated = await prisma.payment.update({
      where: { id },
      data: updateData,
      include: {
        client: {
          select: {
            id: true,
            fullName: true,
            userId: true,
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
              }
            }
          }
        },
        lesson: {
          select: {
            id: true,
            startTime: true,
            type: true
          }
        }
      }
    });

    console.log(`✅ Платеж ${id} обновлен пользователем ${userId} (роль: ${userRole})`);

    res.json({
      ...updated,
      amount: Number(updated.amount)
    });
  } catch (err: any) {
    console.error('❌ Ошибка при обновлении оплаты:', err);
    res.status(500).json({ error: 'Ошибка при обновлении оплаты', details: err.message });
  }
};

// Удаление оплаты
export const remove = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Неверный ID платежа' });
    }

    const userId = req.userId;
    const userRole = req.user?.role;
    
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    // Проверяем существование платежа
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        client: {
          select: {
            userId: true
          }
        }
      }
    });

    if (!payment) {
      return res.status(404).json({ error: 'Оплата не найдена' });
    }

    // АДМИН МОЖЕТ УДАЛЯТЬ ЛЮБОЙ ПЛАТЕЖ
    // Преподаватель может удалять только платежи своих клиентов
    if (userRole !== 'ADMIN' && payment.client.userId !== userId) {
      return res.status(403).json({ 
        error: 'Доступ запрещен',
        message: 'Этот платеж не принадлежит вашему клиенту'
      });
    }

    await prisma.payment.delete({ where: { id } });
    
    console.log(`✅ Платеж ${id} удален пользователем ${userId} (роль: ${userRole})`);
    
    res.status(200).json({ message: 'Оплата удалена' });
  } catch (err: any) {
    console.error('❌ Ошибка при удалении оплаты:', err);
    res.status(500).json({ error: 'Ошибка при удалении оплаты', details: err.message });
  }
};

// Получить статистику по платежам
export const getStats = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    const userRole = req.user?.role;
    
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    let whereCondition: any = {
      client: {
        deletedAt: null
      }
    };
    
    // АДМИН ВИДИТ СТАТИСТИКУ ПО ВСЕМ ПЛАТЕЖАМ
    if (userRole !== 'ADMIN') {
      whereCondition.client.userId = userId;
    }

    const [totalAmount, paymentsCount, avgAmount] = await Promise.all([
      prisma.payment.aggregate({
        where: whereCondition,
        _sum: {
          amount: true
        }
      }),
      prisma.payment.count({
        where: whereCondition
      }),
      prisma.payment.aggregate({
        where: whereCondition,
        _avg: {
          amount: true
        }
      })
    ]);

    const stats = {
      totalAmount: Number(totalAmount._sum.amount || 0),
      paymentsCount,
      avgAmount: Number(avgAmount._avg.amount || 0),
    };

    console.log(`✅ Статистика платежей для ${userId} (роль: ${userRole}):`, stats);

    res.json(stats);
  } catch (err: any) {
    console.error('❌ Ошибка при получении статистики:', err);
    res.status(500).json({ error: 'Ошибка при получении статистики', details: err.message });
  }
};