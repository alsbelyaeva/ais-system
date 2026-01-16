import { useEffect, useState } from 'react';
import axios from 'axios';
import { Save } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://192.168.56.104:4000';

interface TimePreference {
  period: 'morning' | 'day' | 'evening';
  enabled: boolean;
  weight: number;
}

interface Weights {
  workingDays: number[];
  preferredTimes: {
    morning: TimePreference;
    day: TimePreference;
    evening: TimePreference;
  };
  minGapMinutes: number;
  maxGapMinutes: number;
  gapImportance: number;
}

const DAYS_OF_WEEK = [
  { value: 1, label: 'Понедельник' },
  { value: 2, label: 'Вторник' },
  { value: 3, label: 'Среда' },
  { value: 4, label: 'Четверг' },
  { value: 5, label: 'Пятница' },
  { value: 6, label: 'Суббота' },
  { value: 0, label: 'Воскресенье' },
];

const TIME_PERIODS = {
  morning: { start: 6, end: 12, label: 'Утро (6:00-12:00)', emoji: '🌅' },
  day: { start: 12, end: 18, label: 'День (12:00-18:00)', emoji: '☀️' },
  evening: { start: 18, end: 23, label: 'Вечер (18:00-23:00)', emoji: '🌙' }
};

export default function Settings() {
  const { user } = useAuth();
  const [weights, setWeights] = useState<Weights>({
    workingDays: [1, 2, 3, 4, 5],
    preferredTimes: {
      morning: { period: 'morning', enabled: false, weight: 0.5 },
      day: { period: 'day', enabled: true, weight: 0.7 },
      evening: { period: 'evening', enabled: false, weight: 0.5 }
    },
    minGapMinutes: 60,
    maxGapMinutes: 180,
    gapImportance: 0.5
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.id) {
      fetchWeights();
    }
  }, [user]);

  const fetchWeights = async () => {
    try {
      const userId = String(user?.id);
      const response = await axios.get(`${API_URL}/api/slot-weights/${userId}`);
      
      if (response.data && typeof response.data === 'object') {
        setWeights({
          workingDays: response.data.workingDays || [1, 2, 3, 4, 5],
          preferredTimes: response.data.preferredTimes || {
            morning: { period: 'morning', enabled: false, weight: 0.5 },
            day: { period: 'day', enabled: true, weight: 0.7 },
            evening: { period: 'evening', enabled: false, weight: 0.5 }
          },
          minGapMinutes: response.data.minGapMinutes || 60,
          maxGapMinutes: response.data.maxGapMinutes || 180,
          gapImportance: response.data.gapImportance || 0.5
        });
      }
    } catch (error) {
      console.log('Веса не найдены, используются значения по умолчанию');
    }
  };

  const handleSave = async () => {
    if (!user?.id) {
      setError('Пользователь не авторизован');
      return;
    }

    if (weights.workingDays.length === 0) {
      setError('Выберите хотя бы один рабочий день');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const userId = String(user.id);
      
      const weightsToSend = {
        wTime: 0.33,
        wCompact: 0.33,
        wPriority: 0.34,
        workingDays: weights.workingDays,
        preferredTimes: weights.preferredTimes,
        minGapMinutes: weights.minGapMinutes,
        maxGapMinutes: weights.maxGapMinutes,
        gapImportance: weights.gapImportance
      };

      console.log('Сохранение настроек для пользователя:', userId);
      
      await axios.put(`${API_URL}/api/slot-weights/${userId}`, weightsToSend);
      alert('✅ Настройки успешно сохранены');
    } catch (error: any) {
      console.error('Ошибка сохранения:', error);
      const errorMessage = error.response?.data?.error || 
                          error.response?.data?.message || 
                          'Ошибка сохранения';
      setError(errorMessage);
      alert('❌ ' + errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const toggleWorkingDay = (day: number) => {
    setWeights(prev => {
      const isSelected = prev.workingDays.includes(day);
      if (isSelected) {
        return {
          ...prev,
          workingDays: prev.workingDays.filter(d => d !== day)
        };
      } else {
        return {
          ...prev,
          workingDays: [...prev.workingDays, day].sort()
        };
      }
    });
  };

  const formatGapTime = (minutes: number): string => {
    if (minutes < 60) {
      return `${minutes} мин`;
    } else if (minutes < 1440) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return mins > 0 ? `${hours} ч ${mins} мин` : `${hours} ч`;
    } else {
      return `${minutes / 1440} дн`;
    }
  };

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-800 mb-8">Настройки ранжирования</h1>

      <div className="bg-white rounded-lg shadow p-6 max-w-4xl">
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="space-y-8">
          {/* Рабочие дни */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Рабочие дни недели</h3>
            <p className="text-sm text-gray-600 mb-4">
              Выберите дни, в которые вы принимаете клиентов
            </p>
            <div className="grid grid-cols-2 gap-2">
              {DAYS_OF_WEEK.map((day) => (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => toggleWorkingDay(day.value)}
                  className={`px-4 py-3 rounded-lg border-2 transition-all font-medium ${
                    weights.workingDays.includes(day.value)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                  }`}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>

          {/* Предпочтительное время дня */}
          <div className="pt-6 border-t">
            <h3 className="text-lg font-semibold mb-3">Предпочтительное время дня</h3>
            <p className="text-sm text-gray-600 mb-4">
              Выберите удобные временные интервалы и их важность. 
              Если время неважно - оставьте низкий вес (0.1-0.3).
              Если важно не работать в это время - установите высокий вес (0.7-0.9).
            </p>
            
            <div className="space-y-4">
              {Object.entries(TIME_PERIODS).map(([key, period]) => {
                const pref = weights.preferredTimes[key as keyof typeof weights.preferredTimes];
                
                return (
                  <div key={key} className="border rounded-lg p-4 bg-gray-50">
                    <div className="flex items-center justify-between mb-3">
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={pref.enabled}
                          onChange={(e) => {
                            setWeights({
                              ...weights,
                              preferredTimes: {
                                ...weights.preferredTimes,
                                [key]: {
                                  ...pref,
                                  enabled: e.target.checked
                                }
                              }
                            });
                          }}
                          className="w-5 h-5 mr-3"
                        />
                        <span className="font-semibold text-lg">
                          {period.emoji} {period.label}
                        </span>
                      </label>
                      
                      {pref.enabled && (
                        <span className="text-sm font-semibold text-blue-600 bg-blue-100 px-3 py-1 rounded-full">
                          Вес: {pref.weight.toFixed(1)}
                        </span>
                      )}
                    </div>
                    
                    {pref.enabled && (
                      <div>
                        <input
                          type="range"
                          min="0.1"
                          max="0.9"
                          step="0.1"
                          value={pref.weight}
                          onChange={(e) => {
                            setWeights({
                              ...weights,
                              preferredTimes: {
                                ...weights.preferredTimes,
                                [key]: {
                                  ...pref,
                                  weight: parseFloat(e.target.value)
                                }
                              }
                            });
                          }}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                          <span>Неважно (0.1)</span>
                          <span>Очень важно (0.9)</span>
                        </div>
                        <p className="text-xs text-gray-600 mt-2 bg-white p-2 rounded">
                          {pref.weight < 0.4 
                            ? '📅 Время дня почти не влияет на ранжирование'
                            : pref.weight < 0.7
                            ? '⚖️ Умеренное влияние на ранжирование'
                            : '⭐ Сильное влияние - неудобное время сильно снижает рейтинг'
                          }
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>💡 Пример:</strong> Если вы не хотите работать утром, включите "Утро" 
                и установите высокий вес (0.8-0.9). Занятия на 9:00 будут получать низкий балл, 
                а занятия на 17:00 - высокий.
              </p>
            </div>
          </div>

          {/* Промежуток между занятиями */}
          <div className="pt-6 border-t">
            <h3 className="text-lg font-semibold mb-3">Промежуток между занятиями</h3>
            <p className="text-sm text-gray-600 mb-4">
              Укажите желаемый диапазон времени между занятиями
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2">
                  Минимальный промежуток: {formatGapTime(weights.minGapMinutes)}
                </label>
                <select
                  value={weights.minGapMinutes}
                  onChange={(e) => setWeights({ 
                    ...weights, 
                    minGapMinutes: parseInt(e.target.value) 
                  })}
                  className="w-full px-4 py-2 border rounded-lg bg-white"
                >
                  <option value="0">Без промежутка</option>
                  <option value="30">30 минут</option>
                  <option value="60">1 час</option>
                  <option value="90">1.5 часа</option>
                  <option value="120">2 часа</option>
                  <option value="180">3 часа</option>
                  <option value="240">4 часа</option>
                  <option value="360">6 часов</option>
                  <option value="480">8 часов</option>
                  <option value="720">12 часов</option>
                  <option value="1440">24 часа (максимум 1 занятие в день)</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Занятия с промежутком меньше указанного получат низкую оценку
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-semibold mb-2">
                  Оптимальный промежуток: {formatGapTime(weights.maxGapMinutes)}
                </label>
                <select
                  value={weights.maxGapMinutes}
                  onChange={(e) => setWeights({ 
                    ...weights, 
                    maxGapMinutes: parseInt(e.target.value) 
                  })}
                  className="w-full px-4 py-2 border rounded-lg bg-white"
                >
                  <option value="60">1 час</option>
                  <option value="90">1.5 часа</option>
                  <option value="120">2 часа</option>
                  <option value="180">3 часа</option>
                  <option value="240">4 часа</option>
                  <option value="360">6 часов</option>
                  <option value="480">8 часов</option>
                  <option value="720">12 часов</option>
                  <option value="1440">24 часа</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Занятия с таким промежутком получат наивысшую оценку
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-semibold mb-2">
                  Важность промежутка: {weights.gapImportance.toFixed(1)}
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="0.9"
                  step="0.1"
                  value={weights.gapImportance}
                  onChange={(e) => setWeights({ 
                    ...weights, 
                    gapImportance: parseFloat(e.target.value) 
                  })}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Неважно (0.1)</span>
                  <span>Очень важно (0.9)</span>
                </div>
                <p className="text-xs text-gray-600 mt-2 bg-white p-2 rounded">
                  {weights.gapImportance < 0.4 
                    ? '📅 Промежуток почти не влияет на ранжирование'
                    : weights.gapImportance < 0.7
                    ? '⚖️ Умеренное влияние'
                    : '⭐ Сильное влияние - занятия с неподходящим промежутком получат низкий рейтинг'
                  }
                </p>
              </div>
            </div>
            
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800">
                <strong>💡 Пример:</strong> Если вам нужен час на дорогу между занятиями, 
                установите минимум = 1 час, оптимум = 2 часа, важность = 0.8. 
                Занятия с промежутком 30 минут получат низкий балл, 
                с промежутком 2 часа - высокий балл.
              </p>
            </div>
          </div>

          {/* Кнопка сохранения */}
          <button
            onClick={handleSave}
            disabled={loading || !user?.id}
            className="w-full flex items-center justify-center bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold text-lg shadow-lg"
          >
            <Save className="w-5 h-5 mr-2" />
            {loading ? 'Сохранение...' : 'Сохранить настройки'}
          </button>
        </div>
      </div>
    </div>
  );
}