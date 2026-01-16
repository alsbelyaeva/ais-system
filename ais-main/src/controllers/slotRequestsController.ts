import { Request, Response } from 'express';
import prisma from '../utils/prismaClient';

export async function getAll(req: Request, res: Response) {
  try {
    const userId = req.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }
    
    // Получаем только активные запросы (не принятые и не отклоненные)
    const requests = await prisma.slotRequest.findMany({
      where: {
        client: {
          userId: userId
        },
        status: {
          in: ['PENDING', 'NEW'] // Только активные запросы
        }
      },
      include: { 
        client: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            vip: true
          }
        } 
      },
      orderBy: { createdAt: 'desc' },
    });
    
    console.log(`✅ Получено ${requests.length} активных запросов слотов для пользователя ${userId}`);
    
    res.json(requests);
  } catch (err: any) {
    console.error('❌ Ошибка при получении slot requests:', err);
    res.status(500).json({ error: 'Ошибка при получении запросов слотов', details: err.message });
  }
}

export async function getById(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Некорректный id запроса' });
    }
    
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const request = await prisma.slotRequest.findFirst({
      where: { 
        id: id,
        client: {
          userId: userId
        }
      },
      include: {
        client: {
          select: {
            id: true,
            fullName: true
          }
        }
      }
    });
    
    if (!request) {
      return res.status(404).json({ error: 'Запрос не найден' });
    }
    
    res.json(request);
  } catch (err: any) {
    console.error('❌ Ошибка при получении slot request по id:', err);
    res.status(500).json({ error: 'Ошибка при получении запроса слота', details: err.message });
  }
}

// Создание slot request
export async function create(req: Request, res: Response) {
  try {
    const userId = req.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }
    
    const body: any = req.body ?? {};
    let { clientId, proposedSlots, status } = body;

    // Валидация clientId
    if (!clientId || !Number.isInteger(Number(clientId)) || Number(clientId) <= 0) {
      return res.status(400).json({ error: 'Некорректный clientId' });
    }
    
    clientId = Number(clientId);
    
    // Проверяем что клиент принадлежит пользователю
    const client = await prisma.client.findFirst({
      where: { 
        id: clientId,
        userId: userId 
      }
    });
    
    if (!client) {
      return res.status(404).json({ error: 'Клиент не найден или не принадлежит вам' });
    }

    // Если слоты не переданы, создаём один слот "сейчас + 1 час"
    if (!proposedSlots || !Array.isArray(proposedSlots)) {
      const now = new Date();
      const later = new Date(now.getTime() + 60 * 60 * 1000);
      proposedSlots = [
        {
          from: now.toISOString(),
          to: later.toISOString(),
        },
      ];
    }

    if (!status) {
      status = 'PENDING';
    }

    const created = await prisma.slotRequest.create({
      data: {
        clientId: clientId,
        proposedSlots,
        status,
      },
      include: {
        client: {
          select: {
            id: true,
            fullName: true,
            vip: true
          }
        }
      }
    });

    console.log(`✅ Запрос слота создан с ID: ${created.id} для клиента ${client.fullName}`);
    
    res.status(201).json(created);
  } catch (err: any) {
    console.error('❌ Ошибка при создании slot request:', err);
    res.status(500).json({ error: 'Ошибка при создании запроса слота', details: err.message });
  }
}

export async function update(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Некорректный id запроса' });
    }
    
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const data: any = req.body ?? {};
    let updateData: any = {};

    // Проверяем что запрос принадлежит пользователю
    const existingRequest = await prisma.slotRequest.findFirst({
      where: { 
        id: id,
        client: {
          userId: userId
        }
      }
    });
    
    if (!existingRequest) {
      return res.status(404).json({ error: 'Запрос не найден' });
    }

    // Обновляем статус
    if (data.status !== undefined) {
      updateData.status = data.status;
    }

    // Обновляем слоты
    if (data.proposedSlots !== undefined) {
      updateData.proposedSlots = data.proposedSlots;
    }

    // Изменение клиента
    if (data.clientId !== undefined) {
      const cid = Number(data.clientId);
      if (!Number.isInteger(cid) || cid <= 0) {
        return res.status(400).json({ error: 'Некорректный clientId' });
      }
      
      // Проверяем что новый клиент принадлежит пользователю
      const client = await prisma.client.findFirst({
        where: { 
          id: cid,
          userId: userId 
        }
      });
      
      if (!client) {
        return res.status(404).json({ error: 'Клиент не найден или не принадлежит вам' });
      }
      
      updateData.clientId = cid;
    }

    const updated = await prisma.slotRequest.update({
      where: { id },
      data: updateData,
      include: {
        client: {
          select: {
            id: true,
            fullName: true
          }
        }
      }
    });
    
    console.log(`✅ Запрос слота ${id} обновлен`);
    
    res.json(updated);
  } catch (err: any) {
    console.error('❌ Ошибка при обновлении slot request:', err);
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Запрос не найден' });
    }
    res.status(500).json({ error: 'Ошибка при обновлении запроса слота', details: err.message });
  }
}

export async function remove(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Некорректный id запроса' });
    }
    
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const existing = await prisma.slotRequest.findFirst({
      where: { 
        id: id,
        client: {
          userId: userId
        }
      }
    });
    
    if (!existing) {
      return res.status(404).json({ error: 'Запрос не найден' });
    }

    await prisma.slotRequest.delete({ where: { id } });
    
    console.log(`✅ Запрос слота ${id} удален пользователем ${userId}`);
    
    res.json({ message: 'Запрос удален' });
  } catch (err: any) {
    console.error('❌ Ошибка при удалении slot request:', err);
    res.status(500).json({ error: 'Ошибка при удалении запроса слота', details: err.message });
  }
}

// Принятие конкретного слота из запроса
export async function acceptSlot(req: Request, res: Response) {
  try {
    const requestId = Number(req.params.id);
    const userId = req.userId;
    const { slotIndex } = req.body;
    
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    if (slotIndex === undefined || !Number.isInteger(slotIndex)) {
      return res.status(400).json({ error: 'Требуется slotIndex' });
    }

    const request = await prisma.slotRequest.findFirst({
      where: { 
        id: requestId,
        client: {
          userId: userId
        }
      },
      include: {
        client: true
      }
    });

    if (!request) {
      return res.status(404).json({ error: 'Запрос не найден' });
    }

    const slots = request.proposedSlots as any[];
    
    if (slotIndex < 0 || slotIndex >= slots.length) {
      return res.status(400).json({ error: 'Некорректный индекс слота' });
    }

    const selectedSlot = slots[slotIndex];

    // Помечаем запрос как принятый
    await prisma.slotRequest.update({
      where: { id: requestId },
      data: { status: 'ACCEPTED' }
    });

    console.log(`✅ Слот ${slotIndex} из запроса ${requestId} принят`);

    res.json({ 
      message: 'Слот принят',
      slot: selectedSlot,
      request: request
    });
  } catch (err: any) {
    console.error('❌ Ошибка при принятии слота:', err);
    res.status(500).json({ error: 'Ошибка при принятии слота', details: err.message });
  }
}

// Отклонение конкретного слота из запроса
export async function rejectSlot(req: Request, res: Response) {
  try {
    const requestId = Number(req.params.id);
    const userId = req.userId;
    const { slotIndex } = req.body;
    
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const request = await prisma.slotRequest.findFirst({
      where: { 
        id: requestId,
        client: {
          userId: userId
        }
      }
    });

    if (!request) {
      return res.status(404).json({ error: 'Запрос не найден' });
    }

    if (slotIndex !== undefined) {
      // Отклоняем конкретный слот - удаляем его из массива
      const slots = request.proposedSlots as any[];
      const newSlots = slots.filter((_, idx) => idx !== slotIndex);
      
      if (newSlots.length === 0) {
        // Если слотов не осталось, отклоняем весь запрос
        await prisma.slotRequest.update({
          where: { id: requestId },
          data: { status: 'REJECTED' }
        });
      } else {
        // Обновляем массив слотов
        await prisma.slotRequest.update({
          where: { id: requestId },
          data: { proposedSlots: newSlots }
        });
      }
    } else {
      // Отклоняем весь запрос
      await prisma.slotRequest.update({
        where: { id: requestId },
        data: { status: 'REJECTED' }
      });
    }

    console.log(`✅ Слот/запрос ${requestId} отклонен`);

    res.json({ message: 'Запрос отклонен' });
  } catch (err: any) {
    console.error('❌ Ошибка при отклонении слота:', err);
    res.status(500).json({ error: 'Ошибка при отклонении слота', details: err.message });
  }
}