import { Lesson } from '@prisma/client';

export interface ProposedSlot {
  date_time: string; // ISO 8601
  duration: number;  // minutes
}

export interface RankingBreakdown {
  time: number;
  compact: number;
  weekday: number;
  priority: number;
}

export interface RankedSlot {
  date_time: string;
  duration: number;
  score: number; // 0–100
  breakdown: RankingBreakdown;
  explanation: string;
}

export interface SlotWeightConfig {
  w_time: number;
  w_compact: number;
  w_weekday: number;
  w_priority: number;
}

/**
 * Основная функция ранжирования
 */
export const rankSlots = (
  proposedSlots: ProposedSlot[],
  lessons: Lesson[],
  weights: SlotWeightConfig,
  clientVip: boolean
): RankedSlot[] => {
  // 1. Нормализуем веса
  const sum = weights.w_time + weights.w_compact + weights.w_weekday + weights.w_priority;
  const normWeights = sum > 0 ? {
    w_time: weights.w_time / sum,
    w_compact: weights.w_compact / sum,
    w_weekday: weights.w_weekday / sum,
    w_priority: weights.w_priority / sum,
  } : { w_time: 0.4, w_compact: 0.3, w_weekday: 0.2, w_priority: 0.1 };

  // 2. Преобразуем уроки в JS Date
  const lessonTimes = lessons.map(l => new Date(l.start_time));

  return proposedSlots.map(slot => {
    const slotTime = new Date(slot.date_time);
    const now = new Date();

    // === c_time: близость к текущему времени (7 дней макс) ===
    const timeDiffMs = Math.abs(slotTime.getTime() - now.getTime());
    const timeDays = timeDiffMs / (24 * 60 * 60 * 1000);
    const c_time = Math.max(0, 1 - timeDays / 7);

    // === c_compact: компактность (расстояние до ближайшего занятия) ===
    let minGapMin = Infinity;
    for (const lessonTime of lessonTimes) {
      const gap = Math.abs((slotTime.getTime() - lessonTime.getTime()) / 60000);
      if (gap > 0 && gap < minGapMin) minGapMin = gap;
    }
    const c_compact = minGapMin === Infinity ? 0.33 : 1 / (1 + minGapMin / 120);

    // === c_weekday: будни vs выходные ===
    const weekday = slotTime.getUTCDay(); // 0 = воскресенье
    const c_weekday = weekday === 0 || weekday === 6
      ? (weekday === 6 ? 0.5 : 0.0)
      : 1.0;

    // === c_priority: VIP-бонус ===
    const c_priority = clientVip ? 0.1 : 0.0;

    // === Итоговый скор ===
    const U = (
      normWeights.w_time * c_time +
      normWeights.w_compact * c_compact +
      normWeights.w_weekday * c_weekday +
      normWeights.w_priority * c_priority
    );

    // Пояснение для UI
    const parts: string[] = [];
    if (c_weekday === 1.0) parts.push('Будний день (+25%)');
    else if (c_weekday === 0.5) parts.push('Суббота (+12.5%)');
    if (minGapMin !== Infinity && minGapMin < 120) parts.push(`Расстояние до ближ. занятия: ${Math.round(minGapMin)} мин (+${Math.round(c_compact * 25)}%)`);
    if (clientVip) parts.push('Клиент VIP (+10%)');
    if (c_time > 0.8) parts.push('Близко к текущей дате (+ до 20%)');

    return {
      date_time: slot.date_time,
      duration: slot.duration,
      score: Math.round(U * 100),
      breakdown: { time: c_time, compact: c_compact, weekday: c_weekday, priority: c_priority },
      explanation: parts.length > 0 ? parts.join(', ') : 'Нейтральный слот',
    };
  }).sort((a, b) => b.score - a.score); // DESC
};