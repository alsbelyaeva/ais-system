import { useEffect, useState } from 'react';
import axios from 'axios';
import { Plus, X, TrendingUp, AlertTriangle, Star, Trash2 } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://192.168.56.104:4000';

interface RankedSlot {
  from: string;
  to: string;
  score: number;
  breakdown: {
    timeScore: number;
    compactScore: number;
    workingDayScore: number;
    priorityScore: number;
  };
  explanation: string;
  hasConflict: boolean;
  conflictingLesson?: {
    id: number;
    clientName: string;
    startTime: string;
  };
}

interface Client {
  id: number;
  fullName: string;
  vip?: boolean;
}

interface ClientRequest {
  clientId: number;
  clientName: string;
  slots: RankedSlot[];
  vip: boolean;
}

interface SlotInput {
  date: string;
  startTime: string;
  durationMin: number;
}

// Функция для форматирования даты в ISO строку БЕЗ изменения временной зоны
function formatToISOLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

export default function SlotRequests() {
  const [clients, setClients] = useState<Client[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState('');
  const [slots, setSlots] = useState<SlotInput[]>([{ date: '', startTime: '', durationMin: 60 }]);
  const [allClientRequests, setAllClientRequests] = useState<ClientRequest[]>([]);

  useEffect(() => {
    fetchClients();
    
    const saved = localStorage.getItem('allClientRequests');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setAllClientRequests(data);
        console.log('📥 Загружено запросов из localStorage:', data.length);
      } catch (e) {
        console.error('Ошибка загрузки запросов:', e);
      }
    }
  }, []);

  useEffect(() => {
    if (allClientRequests.length > 0) {
      localStorage.setItem('allClientRequests', JSON.stringify(allClientRequests));
      console.log('💾 Запросы сохранены в localStorage');
    }
  }, [allClientRequests]);

  const fetchClients = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/clients`);
      setClients(response.data);
    } catch (error) {
      console.error('Failed to fetch clients:', error);
    }
  };

  const addSlot = () => {
    setSlots([...slots, { date: '', startTime: '', durationMin: 60 }]);
  };

  const removeSlot = (index: number) => {
    if (slots.length === 1) {
      alert('Должен остаться хотя бы один слот');
      return;
    }
    setSlots(slots.filter((_, i) => i !== index));
  };

  const updateSlot = (index: number, field: keyof SlotInput, value: string | number) => {
    const newSlots = [...slots];
    newSlots[index] = { ...newSlots[index], [field]: value };
    setSlots(newSlots);
  };

  const calculateEndTime = (date: string, time: string, duration: number): string => {
    if (!date || !time) return '—';
    try {
      const start = new Date(`${date}T${time}`);
      const end = new Date(start.getTime() + duration * 60000);
      return end.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '—';
    }
  };

  const handleAddClientRequest = async () => {
    if (!selectedClient) {
      alert('Выберите клиента');
      return;
    }

    const validSlots = slots.filter(s => s.date && s.startTime);

    if (validSlots.length === 0) {
      alert('Добавьте хотя бы один слот с датой и временем');
      return;
    }

    // ИСПРАВЛЕНИЕ: используем локальное время БЕЗ конвертации в UTC
    const proposedSlots = validSlots.map(slot => {
      // Создаем дату начала в локальном времени
      const from = `${slot.date}T${slot.startTime}:00`;
      const fromDate = new Date(from);
      
      // Добавляем длительность
      const toDate = new Date(fromDate.getTime() + slot.durationMin * 60000);
      
      // Форматируем обе даты в локальном времени
      const to = formatToISOLocal(toDate);
      
      console.log('📅 Создан слот:', {
        from,
        to,
        fromDate: fromDate.toString(),
        toDate: toDate.toString(),
        duration: slot.durationMin
      });
      
      return { from, to };
    });

    // Проверяем корректность времени
    for (const slot of proposedSlots) {
      const from = new Date(slot.from);
      const to = new Date(slot.to);
      
      console.log('🔍 Проверка слота:', {
        from: from.toString(),
        to: to.toString(),
        fromTime: from.getTime(),
        toTime: to.getTime(),
        diff: to.getTime() - from.getTime()
      });
      
      if (to <= from) {
        alert(`Ошибка в слоте: время окончания (${to.toLocaleString()}) должно быть позже времени начала (${from.toLocaleString()})`);
        return;
      }
    }

    try {
      console.log('🚀 Отправка на ранжирование:', {
        clientId: parseInt(selectedClient),
        proposedSlots
      });

      const response = await axios.post(`${API_URL}/api/slots/rank`, {
        clientId: parseInt(selectedClient),
        proposedSlots,
      });
      
      const client = clients.find(c => c.id === parseInt(selectedClient));
      
      if (!client) {
        alert('Клиент не найден');
        return;
      }
      
      const newRequest: ClientRequest = {
        clientId: parseInt(selectedClient),
        clientName: client.fullName,
        slots: response.data.rankedSlots,
        vip: client.vip || false
      };
      
      setAllClientRequests([...allClientRequests, newRequest]);
      setShowModal(false);
      
      // Очищаем форму
      setSelectedClient('');
      setSlots([{ date: '', startTime: '', durationMin: 60 }]);
      
      console.log('✅ Запрос добавлен для клиента:', client.fullName);
    } catch (error: any) {
      console.error('❌ Ошибка ранжирования:', error);
      console.error('Детали:', error.response?.data);
      alert(error.response?.data?.error || error.response?.data?.message || 'Ошибка ранжирования');
    }
  };

  const groupSlotsByTime = () => {
    const grouped: Map<string, Array<{
      clientId: number;
      clientName: string;
      slot: RankedSlot;
      vip: boolean;
      requestIndex: number;
      slotIndex: number;
    }>> = new Map();

    allClientRequests.forEach((request, requestIndex) => {
      request.slots.forEach((slot, slotIndex) => {
        const timeKey = `${slot.from}-${slot.to}`;
        
        if (!grouped.has(timeKey)) {
          grouped.set(timeKey, []);
        }
        
        grouped.get(timeKey)!.push({
          clientId: request.clientId,
          clientName: request.clientName,
          slot: slot,
          vip: request.vip,
          requestIndex,
          slotIndex
        });
      });
    });

    return grouped;
  };

  const createLessonForClient = async (
    clientId: number, 
    slot: RankedSlot, 
    requestIndex: number,
    timeKey: string
  ) => {
    try {
      const from = new Date(slot.from);
      const to = new Date(slot.to);
      const duration = Math.round((to.getTime() - from.getTime()) / (1000 * 60));
      
      const isoStartTime = slot.from.length === 16 ? slot.from + ':00' : slot.from;
      
      if (slot.hasConflict && slot.conflictingLesson) {
        const confirmReplace = confirm(
          `⚠️ Это время занято клиентом "${slot.conflictingLesson.clientName}".\n\n` +
          `Вы хотите отменить старое занятие и создать новое?`
        );
        
        if (!confirmReplace) return;
        
        await axios.post(`${API_URL}/api/slots/replace`, {
          conflictingLessonId: slot.conflictingLesson.id,
          selectedSlot: slot,
          clientId: clientId,
          durationMin: duration,
          type: 'Индивидуальное',
        });
      } else {
        await axios.post(`${API_URL}/api/lessons`, {
          clientId: clientId,
          startTime: isoStartTime,
          durationMin: duration,
          type: 'Индивидуальное',
          status: 'PLANNED',
        });
      }

      alert('✅ Занятие создано!');
      
      // Удаляем все запросы на это время
      const newRequests = allClientRequests.map(request => ({
        ...request,
        slots: request.slots.filter(s => 
          `${s.from}-${s.to}` !== timeKey
        )
      })).filter(request => request.slots.length > 0);
      
      setAllClientRequests(newRequests);
      
      if (newRequests.length === 0) {
        localStorage.removeItem('allClientRequests');
      }
      
    } catch (error: any) {
      console.error('Ошибка создания занятия:', error);
      alert(error.response?.data?.error || 'Ошибка создания занятия');
    }
  };

  const rejectSlot = (requestIndex: number, slotIndex: number) => {
    const newRequests = [...allClientRequests];
    newRequests[requestIndex].slots = newRequests[requestIndex].slots.filter((_, i) => i !== slotIndex);
    
    const filteredRequests = newRequests.filter(r => r.slots.length > 0);
    
    setAllClientRequests(filteredRequests);
    
    if (filteredRequests.length === 0) {
      localStorage.removeItem('allClientRequests');
    }
    
    console.log('❌ Слот отклонен');
  };

  const clearAllRequests = () => {
    if (confirm('Вы уверены, что хотите очистить все запросы?')) {
      setAllClientRequests([]);
      localStorage.removeItem('allClientRequests');
      console.log('🗑️ Все запросы очищены');
    }
  };

  const formatDateTime = (isoString: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleString('ru-RU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatTime = (isoString: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString('ru-RU', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800">
          Запросы слотов
        </h1>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          Добавить запрос
        </button>
      </div>

      {allClientRequests.length > 0 ? (
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">
              Все запросы клиентов ({allClientRequests.length})
            </h2>
            <button
              onClick={clearAllRequests}
              className="flex items-center text-red-600 hover:text-red-800 font-medium text-sm"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Очистить все
            </button>
          </div>
          
          {(() => {
            const grouped = groupSlotsByTime();
            const entries = Array.from(grouped.entries());
            
            return (
              <div className="space-y-6">
                {entries.map(([timeKey, requests], idx) => {
                  const hasMultipleClients = requests.length > 1;
                  const hasConflict = requests.some(r => r.slot.hasConflict);
                  
                  return (
                    <div
                      key={idx}
                      className={`border-2 rounded-lg p-5 ${
                        hasMultipleClients 
                          ? 'border-yellow-400 bg-yellow-50' 
                          : hasConflict
                          ? 'border-red-400 bg-red-50'
                          : 'border-gray-200 bg-white'
                      }`}
                    >
                      <div className="mb-4 pb-3 border-b">
                        <div className="flex items-center gap-3 mb-2">
                          {hasMultipleClients && (
                            <AlertTriangle className="w-6 h-6 text-yellow-600" />
                          )}
                          <span className="font-bold text-xl">
                            {formatDateTime(requests[0].slot.from)} - {formatTime(requests[0].slot.to)}
                          </span>
                          {hasMultipleClients && (
                            <span className="px-3 py-1 bg-yellow-200 text-yellow-900 text-sm rounded-full font-bold">
                              {requests.length} запроса!
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        {requests.map((req, reqIdx) => (
                          <div
                            key={reqIdx}
                            className="border-2 border-gray-300 rounded-lg p-4 bg-white hover:shadow-md transition-shadow"
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-3">
                                  <span className="font-bold text-lg">
                                    {req.clientName}
                                  </span>
                                  {req.vip && (
                                    <div className="flex items-center gap-1 px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded-full font-semibold">
                                      <Star className="w-3 h-3 fill-current" />
                                      VIP
                                    </div>
                                  )}
                                  <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full font-bold">
                                    {req.slot.score.toFixed(2)}
                                  </span>
                                </div>
                                
                                <p className={`text-sm mb-3 ${
                                  req.slot.hasConflict 
                                    ? 'text-red-700 font-semibold' 
                                    : 'text-gray-700'
                                }`}>
                                  {req.slot.explanation}
                                </p>
                                
                                <div className="grid grid-cols-4 gap-2 text-xs">
                                  <div className="bg-blue-50 p-2 rounded border border-blue-200">
                                    <div className="text-gray-600">Время</div>
                                    <div className="font-bold text-blue-700">
                                      {req.slot.breakdown.timeScore.toFixed(2)}
                                    </div>
                                  </div>
                                  <div className="bg-purple-50 p-2 rounded border border-purple-200">
                                    <div className="text-gray-600">Компакт</div>
                                    <div className="font-bold text-purple-700">
                                      {req.slot.breakdown.compactScore.toFixed(2)}
                                    </div>
                                  </div>
                                  <div className="bg-green-50 p-2 rounded border border-green-200">
                                    <div className="text-gray-600">Раб. день</div>
                                    <div className="font-bold text-green-700">
                                      {req.slot.breakdown.workingDayScore.toFixed(2)}
                                    </div>
                                  </div>
                                  <div className="bg-yellow-50 p-2 rounded border border-yellow-200">
                                    <div className="text-gray-600">Приоритет</div>
                                    <div className="font-bold text-yellow-700">
                                      {req.slot.breakdown.priorityScore.toFixed(2)}
                                    </div>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="ml-4 flex flex-col gap-2">
                                <button
                                  onClick={() => createLessonForClient(
                                    req.clientId, 
                                    req.slot, 
                                    req.requestIndex,
                                    timeKey
                                  )}
                                  className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition-colors ${
                                    req.slot.hasConflict
                                      ? 'bg-orange-600 text-white hover:bg-orange-700'
                                      : 'bg-green-600 text-white hover:bg-green-700'
                                  }`}
                                >
                                  {req.slot.hasConflict ? '⚠️ Заменить' : '✓ Принять'}
                                </button>
                                
                                <button
                                  onClick={() => rejectSlot(req.requestIndex, req.slotIndex)}
                                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold"
                                >
                                  ✗ Отклонить
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {hasMultipleClients && (
                        <div className="mt-4 p-3 bg-yellow-100 rounded-lg border border-yellow-300">
                          <p className="text-sm text-yellow-900">
                            <strong>⚠️ Конфликт времени!</strong> Несколько клиентов запросили это же время. 
                            Выберите одного, остальные запросы будут автоматически отклонены.
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <TrendingUp className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">
            Нет активных запросов
          </h3>
          <p className="text-gray-600 mb-6">
            Создайте новый запрос для ранжирования предложенных клиентом слотов
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-semibold"
          >
            <Plus className="w-5 h-5 mr-2" />
            Создать запрос
          </button>
        </div>
      )}

      {/* Модальное окно */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Добавить запрос клиента</h2>
              <button onClick={() => setShowModal(false)}>
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-semibold mb-2">Клиент</label>
              <select
                value={selectedClient}
                onChange={(e) => setSelectedClient(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg"
                required
              >
                <option value="">Выберите клиента</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.fullName} {client.vip ? '⭐ VIP' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <div className="flex justify-between items-center mb-3">
                <label className="block text-sm font-semibold">Предложенные слоты</label>
                <button
                  type="button"
                  onClick={addSlot}
                  className="text-blue-600 hover:text-blue-800 text-sm font-semibold"
                >
                  + Добавить слот
                </button>
              </div>

              <div className="space-y-3">
                {slots.map((slot, idx) => (
                  <div key={idx} className="bg-gray-50 p-4 rounded-lg">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-2">
                      <div>
                        <label className="block text-xs font-semibold mb-1">Дата</label>
                        <input
                          type="date"
                          value={slot.date}
                          onChange={(e) => updateSlot(idx, 'date', e.target.value)}
                          className="w-full px-3 py-2 border rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1">Время начала</label>
                        <input
                          type="time"
                          value={slot.startTime}
                          onChange={(e) => updateSlot(idx, 'startTime', e.target.value)}
                          className="w-full px-3 py-2 border rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1">Длительность</label>
                        <select
                          value={slot.durationMin}
                          onChange={(e) => updateSlot(idx, 'durationMin', parseInt(e.target.value))}
                          className="w-full px-3 py-2 border rounded-lg"
                        >
                          <option value="30">30 минут</option>
                          <option value="45">45 минут</option>
                          <option value="60">1 час</option>
                          <option value="90">1.5 часа</option>
                          <option value="120">2 часа</option>
                          <option value="150">2.5 часа</option>
                          <option value="180">3 часа</option>
                        </select>
                      </div>
                    </div>
                    {slot.date && slot.startTime && (
                      <p className="text-xs text-gray-500 mb-2">
                        Окончание: {calculateEndTime(slot.date, slot.startTime, slot.durationMin)}
                      </p>
                    )}
                    {slots.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSlot(idx)}
                        className="text-red-600 hover:text-red-800 text-sm font-semibold"
                      >
                        Удалить слот
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                💡 Можно добавить несколько временных слотов для одного клиента
              </p>
            </div>

            <button
              onClick={handleAddClientRequest}
              disabled={!selectedClient || slots.every(s => !s.date || !s.startTime)}
              className="w-full flex items-center justify-center bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              <TrendingUp className="w-5 h-5 mr-2" />
              Ранжировать и добавить
            </button>
          </div>
        </div>
      )}
    </div>
  );
}