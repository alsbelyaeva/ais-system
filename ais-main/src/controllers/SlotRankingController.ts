import { Request, Response } from 'express';
import prisma from '../utils/prismaClient';

interface TimePreference {
  period: 'morning' | 'day' | 'evening';
  enabled: boolean;
  weight: number;
}

interface SlotProposal {
  from: string;
  to: string;
}

interface RankedSlot extends SlotProposal {
  score: number;
  breakdown: {
    timeScore: number;
    compactScore: number;
    priorityScore: number;
    workingDayScore: number;
  };
  explanation: string;
  hasConflict: boolean;
  conflictingLesson?: {
    id: number;
    clientName: string;
    startTime: string;
  };
}

export async function rankSlots(req: Request, res: Response) {
  try {
    const userId = req.userId;
    const { proposedSlots, clientId } = req.body;

    console.log('🔍 [rankSlots] Получен запрос:', { userId, clientId, slotsCount: proposedSlots?.length });

    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    if (!proposedSlots || !Array.isArray(proposedSlots) || proposedSlots.length === 0) {
      return res.status(400).json({ error: 'proposedSlots должен быть непустым массивом' });
    }

    if (!clientId) {
      return res.status(400).json({ error: 'clientId обязателен' });
    }

    // Получаем веса пользователя
    let weights = await prisma.slotWeight.findUnique({ where: { userId } });
    
    if (!weights) {
      console.log('⚠️ Веса не найдены, создаем по умолчанию');
      weights = await prisma.slotWeight.create({
        data: {
          userId,
          wTime: 0.33,
          wCompact: 0.33,
          wPriority: 0.34,
          workingDays: [1, 2, 3, 4, 5],
          preferredTimes: {
            morning: { period: 'morning', enabled: false, weight: 0.5 },
            day: { period: 'day', enabled: true, weight: 0.7 },
            evening: { period: 'evening', enabled: false, weight: 0.5 }
          },
          minGapMinutes: 60,
          maxGapMinutes: 180,
          gapImportance: 0.5
        },
      });
    }

    // Получаем рабочие дни и предпочтительные времена
    const workingDays = (weights.workingDays as number[]) || [1, 2, 3, 4, 5];
    const preferredTimes = (weights.preferredTimes as any) || {
      morning: { period: 'morning', enabled: false, weight: 0.5 },
      day: { period: 'day', enabled: true, weight: 0.7 },
      evening: { period: 'evening', enabled: false, weight: 0.5 }
    };
    const minGapMinutes = weights.minGapMinutes || 60;
    const maxGapMinutes = weights.maxGapMinutes || 180;
    const gapImportance = weights.gapImportance || 0.5;

    // Получаем клиента для проверки VIP статуса
    const client = await prisma.client.findFirst({
      where: { 
        id: clientId,
        userId: userId
      }
    });

    if (!client) {
      return res.status(404).json({ error: 'Клиент не найден или не принадлежит вам' });
    }

    // Получаем ВСЕ запланированные занятия пользователя
    const lessons = await prisma.lesson.findMany({
      where: {
        userId,
        status: 'PLANNED',
      },
      include: {
        client: {
          select: {
            fullName: true
          }
        }
      },
      orderBy: { startTime: 'asc' },
    });

    console.log(`📊 Найдено ${lessons.length} запланированных занятий`);

    // Ранжируем каждый слот
    const rankedSlots: RankedSlot[] = proposedSlots.map((slot: SlotProposal) => {
      const slotStart = new Date(slot.from);
      const slotEnd = new Date(slot.to);
      const durationMin = Math.round((slotEnd.getTime() - slotStart.getTime()) / (1000 * 60));
      
      // Проверяем коллизии с существующими занятиями
      const conflict = checkTimeConflict(slotStart, slotEnd, lessons);
      
      // 1. Time score (предпочтение времени дня на основе настроек)
      const timeScore = calculateTimeScoreFromPreferences(slotStart, preferredTimes);

      // 2. Compact score (близость к другим занятиям с учетом gap preferences)
      const compactScore = calculateCompactScoreWithGaps(
        slotStart, 
        durationMin, 
        lessons, 
        minGapMinutes, 
        maxGapMinutes
      );

      // 3. Working day score (выбранные рабочие дни)
      const workingDayScore = calculateWorkingDayScore(slotStart, workingDays);

      // 4. Priority score (VIP клиенты)
      const priorityScore = client?.vip ? 1.0 : 0.5;

      // Итоговый score с учетом важности промежутков
      let baseScore =
        weights.wTime * timeScore +
        weights.wCompact * compactScore * (1 - gapImportance * 0.5) + // Уменьшаем влияние компактности
        weights.wPriority * priorityScore +
        gapImportance * 0.3 * workingDayScore; // Добавляем влияние промежутков

      // Сильно понижаем рейтинг при конфликте
      const finalScore = conflict ? baseScore * 0.1 : baseScore;

      return {
        ...slot,
        score: Math.round(finalScore * 100) / 100,
        breakdown: {
          timeScore: Math.round(timeScore * 100) / 100,
          compactScore: Math.round(compactScore * 100) / 100,
          workingDayScore: Math.round(workingDayScore * 100) / 100,
          priorityScore: Math.round(priorityScore * 100) / 100,
        },
        explanation: generateExplanation(
          timeScore, 
          compactScore, 
          workingDayScore, 
          priorityScore, 
          client?.vip,
          conflict
        ),
        hasConflict: !!conflict,
        conflictingLesson: conflict ? {
          id: conflict.id,
          clientName: conflict.client.fullName,
          startTime: conflict.startTime.toISOString()
        } : undefined,
      };
    });

    // Сортируем по убыванию score
    rankedSlots.sort((a, b) => b.score - a.score);

    console.log('✅ Ранжирование завершено:', rankedSlots.map(s => ({ 
      time: s.from, 
      score: s.score, 
      conflict: s.hasConflict 
    })));

    res.json({ 
      rankedSlots,
      weights: {
        wTime: weights.wTime,
        wCompact: weights.wCompact,
        wPriority: weights.wPriority,
        workingDays: workingDays,
        preferredTimes: preferredTimes,
        minGapMinutes: minGapMinutes,
        maxGapMinutes: maxGapMinutes,
        gapImportance: gapImportance
      },
      clientVip: client?.vip || false
    });
  } catch (err: any) {
    console.error('❌ Ошибка ранжирования слотов:', err);
    res.status(500).json({ error: 'Ошибка ранжирования', details: err.message });
  }
}

// Функция проверки временных конфликтов
function checkTimeConflict(slotStart: Date, slotEnd: Date, lessons: any[]): any | null {
  for (const lesson of lessons) {
    const lessonStart = new Date(lesson.startTime);
    const lessonEnd = new Date(lessonStart.getTime() + lesson.durationMin * 60 * 1000);
    
    // Проверяем пересечение временных интервалов
    if (slotStart < lessonEnd && slotEnd > lessonStart) {
      return lesson;
    }
  }
  return null;
}

// Новая функция расчета времени дня на основе предпочтений
function calculateTimeScoreFromPreferences(date: Date, preferredTimes: any): number {
  const hour = date.getHours();
  
  // Проверяем каждый период
  let score = 0.5; // Базовый score
  
  if (preferredTimes.morning?.enabled && hour >= 6 && hour < 12) {
    score = preferredTimes.morning.weight;
  } else if (preferredTimes.day?.enabled && hour >= 12 && hour < 18) {
    score = preferredTimes.day.weight;
  } else if (preferredTimes.evening?.enabled && hour >= 18 && hour < 23) {
    score = preferredTimes.evening.weight;
  }
  
  return score;
}

// Улучшенная функция расчета компактности с учетом промежутков
function calculateCompactScoreWithGaps(
  slotStart: Date, 
  slotDuration: number,
  lessons: any[],
  minGap: number,
  maxGap: number
): number {
  if (lessons.length === 0) return 0.5;

  const slotEnd = new Date(slotStart.getTime() + slotDuration * 60 * 1000);
  let bestScore = 0;
  
  for (const lesson of lessons) {
    const lessonStart = new Date(lesson.startTime);
    const lessonEnd = new Date(lessonStart.getTime() + lesson.durationMin * 60 * 1000);
    
    // Рассчитываем промежуток до и после
    const gapBefore = Math.abs((slotStart.getTime() - lessonEnd.getTime()) / (1000 * 60));
    const gapAfter = Math.abs((lessonStart.getTime() - slotEnd.getTime()) / (1000 * 60));
    
    const minGapDist = Math.min(gapBefore, gapAfter);
    
    let score = 0;
    
    if (minGapDist < minGap) {
      // Слишком близко - низкий балл
      score = 0.2 + (minGapDist / minGap) * 0.3;
    } else if (minGapDist >= minGap && minGapDist <= maxGap) {
      // Идеальный промежуток - высокий балл
      score = 1.0;
    } else {
      // Слишком далеко - средний балл с убыванием
      const excessGap = minGapDist - maxGap;
      score = Math.max(0.3, 0.8 - (excessGap / (maxGap * 2)) * 0.5);
    }
    
    bestScore = Math.max(bestScore, score);
  }
  
  return bestScore;
}

function calculateWorkingDayScore(date: Date, workingDays: number[]): number {
  const day = date.getDay(); // 0=воскресенье, 1=понедельник, ..., 6=суббота
  return workingDays.includes(day) ? 1.0 : 0.3;
}

export async function selectAndCreateLesson(req: Request, res: Response) {
  try {
    const userId = req.userId;
    const { selectedSlot, clientId, durationMin = 60, type = 'Индивидуальное', notes = null } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    if (!selectedSlot || !selectedSlot.from || !selectedSlot.to) {
      return res.status(400).json({ error: 'Требуется selectedSlot с from и to' });
    }

    if (!clientId) {
      return res.status(400).json({ error: 'Требуется clientId' });
    }

    // Проверяем что клиент принадлежит этому пользователю
    const client = await prisma.client.findFirst({
      where: { 
        id: clientId,
        userId: userId 
      }
    });

    if (!client) {
      return res.status(403).json({ error: 'Клиент не найден или не принадлежит вам' });
    }

    const startTime = new Date(selectedSlot.from);
    const endTime = new Date(startTime.getTime() + durationMin * 60 * 1000);

    // Получаем текущие занятия
    const currentLessons = await prisma.lesson.findMany({
      where: {
        userId,
        status: 'PLANNED'
      },
      include: {
        client: {
          select: {
            fullName: true
          }
        }
      },
      orderBy: { startTime: 'asc' }
    });

    // Проверяем конфликты
    const conflict = checkTimeConflict(startTime, endTime, currentLessons);
    
    if (conflict) {
      return res.status(409).json({ 
        error: 'Конфликт времени',
        message: 'Это время занято другим клиентом',
        conflictingLesson: {
          id: conflict.id,
          clientName: conflict.client?.fullName,
          startTime: conflict.startTime
        },
        canReplace: true
      });
    }

    // Создаем новое занятие
    const newLesson = await prisma.lesson.create({
      data: {
        clientId,
        userId,
        startTime,
        durationMin,
        type,
        status: 'PLANNED',
        notes
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

    console.log(`✅ Занятие создано из выбранного слота, ID: ${newLesson.id}`);

    res.status(201).json({ 
      message: 'Занятие успешно создано',
      lesson: newLesson
    });
  } catch (err: any) {
    console.error('❌ Ошибка при создании занятия:', err);
    res.status(500).json({ error: 'Ошибка при создании занятия', details: err.message });
  }
}

// Функция замены конфликтующего занятия
export async function replaceConflictingLesson(req: Request, res: Response) {
  try {
    const userId = req.userId;
    const { conflictingLessonId, selectedSlot, clientId, durationMin = 60, type = 'Индивидуальное', notes = null } = req.body;

    console.log('🔄 [replaceConflictingLesson] Замена занятия:', { conflictingLessonId, clientId });

    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    if (!conflictingLessonId || !selectedSlot || !clientId) {
      return res.status(400).json({ error: 'Требуются: conflictingLessonId, selectedSlot, clientId' });
    }

    // Проверяем что конфликтующее занятие принадлежит пользователю
    const existingLesson = await prisma.lesson.findFirst({
      where: {
        id: conflictingLessonId,
        userId: userId
      }
    });

    if (!existingLesson) {
      return res.status(404).json({ error: 'Конфликтующее занятие не найдено' });
    }

    // Проверяем что клиент принадлежит пользователю
    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        userId: userId
      }
    });

    if (!client) {
      return res.status(404).json({ error: 'Клиент не найден' });
    }

    // Отменяем старое занятие
    await prisma.lesson.update({
      where: { id: conflictingLessonId },
      data: { status: 'CANCELLED' }
    });

    // Создаем новое занятие
    const startTime = new Date(selectedSlot.from);
    const newLesson = await prisma.lesson.create({
      data: {
        clientId,
        userId,
        startTime,
        durationMin,
        type,
        status: 'PLANNED',
        notes
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

    console.log(`✅ Занятие ${conflictingLessonId} отменено и создано новое ${newLesson.id}`);

    res.status(201).json({ 
      message: 'Занятие заменено',
      cancelledLessonId: conflictingLessonId,
      lesson: newLesson
    });
  } catch (err: any) {
    console.error('❌ Ошибка при замене занятия:', err);
    res.status(500).json({ error: 'Ошибка при замене занятия', details: err.message });
  }
}

function generateExplanation(
  timeScore: number,
  compactScore: number,
  workingDayScore: number,
  priorityScore: number,
  isVip?: boolean,
  hasConflict?: any
): string {
  if (hasConflict) {
    return `⚠️ КОНФЛИКТ: время занято клиентом ${hasConflict.client?.fullName || 'другим клиентом'}`;
  }

  const reasons = [];
  
  if (timeScore >= 0.7) reasons.push('удобное время');
  else if (timeScore < 0.5) reasons.push('неудобное время');
  
  if (compactScore >= 0.8) reasons.push('оптимальный промежуток');
  else if (compactScore < 0.5) reasons.push('неподходящий промежуток');
  
  if (workingDayScore >= 0.9) reasons.push('рабочий день');
  else reasons.push('нерабочий день');
  
  if (isVip) reasons.push('VIP клиент');

  return reasons.join(', ');
}