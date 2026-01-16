import { useEffect, useState } from 'react';
import axios from 'axios';
import { Plus, X, Check, XCircle, Edit, Trash2 } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://192.168.56.104:4000';

interface Lesson {
  id: number;
  startTime: string;
  durationMin: number;
  type: string;
  status: string;
  notes?: string;
  client: { fullName: string };
}

interface Client {
  id: number;
  fullName: string;
}

export default function Calendar() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showLessonDetailsModal, setShowLessonDetailsModal] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [cancelledCount, setCancelledCount] = useState(0);
  const [doneCount, setDoneCount] = useState(0);
  
  // Раздельные поля для даты, времени и длительности
  const [formData, setFormData] = useState({
    clientId: '',
    date: '', // Только дата
    startTime: '', // Только время начала
    durationMin: 60,
    type: 'Индивидуальное',
    status: 'PLANNED',
    notes: '',
  });

  useEffect(() => {
    fetchLessons();
    fetchClients();
    fetchLessonStats();
  }, []);

  const fetchLessons = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/lessons`);
      const sorted = response.data.sort((a: Lesson, b: Lesson) => {
        return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
      });
      setLessons(sorted);
    } catch (error) {
      console.error('Failed to fetch lessons:', error);
    }
  };

  const fetchClients = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/clients`);
      setClients(response.data);
    } catch (error) {
      console.error('Failed to fetch clients:', error);
    }
  };

  const fetchLessonStats = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/lessons/stats`);
      setCancelledCount(response.data.cancelled || 0);
      setDoneCount(response.data.done || 0);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const updateLessonStatus = async (lessonId: number, newStatus: string) => {
    try {
      await axios.patch(`${API_URL}/api/lessons/${lessonId}`, {
        status: newStatus,
      });
      fetchLessons();
      fetchLessonStats();
      setShowLessonDetailsModal(false);
      
      // Показываем уведомление
      alert(`Статус занятия обновлен на "${getStatusText(newStatus)}"`);
    } catch (error: any) {
      console.error('Ошибка обновления статуса:', error);
      alert(error.response?.data?.error || 'Ошибка обновления статуса занятия');
    }
  };

  const deleteLesson = async (lessonId: number) => {
    if (!confirm('Вы уверены, что хотите удалить это занятие? Это действие нельзя отменить.')) {
      return;
    }

    try {
      await axios.delete(`${API_URL}/api/lessons/${lessonId}`);
      fetchLessons();
      fetchLessonStats();
      setShowLessonDetailsModal(false);
      alert('Занятие успешно удалено');
    } catch (error: any) {
      console.error('Ошибка удаления занятия:', error);
      alert(error.response?.data?.error || 'Ошибка удаления занятия');
    }
  };

  const formatLessonTime = (startTime: string, durationMin: number) => {
    const start = new Date(startTime);
    const end = new Date(start.getTime() + durationMin * 60 * 1000);
    
    const startStr = start.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    const endStr = end.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    
    return `${startStr} - ${endStr}`;
  };

  // Функция для расчета времени окончания
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Объединяем дату и время в один ISO формат
    const startDateTime = `${formData.date}T${formData.startTime}:00`;
    
    console.log('📝 Создание занятия:', {
      date: formData.date,
      time: formData.startTime,
      combined: startDateTime,
      duration: formData.durationMin
    });
    
    try {
      const formattedData = {
        clientId: parseInt(formData.clientId),
        startTime: startDateTime,
        durationMin: parseInt(formData.durationMin.toString()),
        type: formData.type,
        status: formData.status,
        notes: formData.notes || null,
      };

      console.log('🚀 Отправка данных на сервер:', formattedData);

      const response = await axios.post(`${API_URL}/api/lessons`, formattedData);
      console.log('✅ Занятие создано:', response.data);
      
      setShowModal(false);
      fetchLessons();
      fetchLessonStats();
      resetForm();
      alert('✅ Занятие успешно создано!');
    } catch (error: any) {
      console.error('❌ Ошибка создания занятия:', error);
      console.error('Детали ошибки:', error.response?.data);
      
      // Проверяем специальную ошибку о пересечении времени
      if (error.response?.status === 409) {
        const errorData = error.response.data;
        const conflictingClients = errorData.conflictingLessons?.map((lesson: any) => 
          `${lesson.clientName} (${new Date(lesson.startTime).toLocaleTimeString('ru-RU', { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}-${new Date(lesson.endTime).toLocaleTimeString('ru-RU', { 
            hour: '2-digit', 
            minute: '2-digit' 
          })})`
        ).join(', ');
        
        alert(`❌ ${errorData.error}\n\n${errorData.message || `Это время занято другими учениками: ${conflictingClients}`}\n\nПожалуйста, выберите другое время.`);
      } else {
        alert(error.response?.data?.error || error.response?.data?.message || 'Ошибка создания занятия');
      }
    }
  };

  const resetForm = () => {
    setFormData({
      clientId: '',
      date: '',
      startTime: '',
      durationMin: 60,
      type: 'Индивидуальное',
      status: 'PLANNED',
      notes: '',
    });
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const lastDay = new Date(year, month + 1, 0);
    const days = [];

    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  };

  const getLessonsForDay = (date: Date) => {
    return lessons.filter((lesson) => {
      const lessonDate = new Date(lesson.startTime);
      return (
        lessonDate.getDate() === date.getDate() &&
        lessonDate.getMonth() === date.getMonth() &&
        lessonDate.getFullYear() === date.getFullYear()
      );
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DONE':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'CANCELLED':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-300';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'DONE':
        return 'Проведено';
      case 'CANCELLED':
        return 'Отменено';
      default:
        return 'Запланировано';
    }
  };

  const days = getDaysInMonth(selectedDate);

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Расписание</h1>
          <div className="flex gap-6 mt-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-gray-600">Отменено:</span>
              <span className="font-semibold text-red-600">{cancelledCount}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-600">Проведено:</span>
              <span className="font-semibold text-green-600">{doneCount}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5 mr-2" />
            Добавить занятие
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-6">
          <button
            onClick={() => {
              const newDate = new Date(selectedDate);
              newDate.setMonth(newDate.getMonth() - 1);
              setSelectedDate(newDate);
            }}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            ← Предыдущий
          </button>
          <h2 className="text-xl font-semibold">
            {selectedDate.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}
          </h2>
          <button
            onClick={() => {
              const newDate = new Date(selectedDate);
              newDate.setMonth(newDate.getMonth() + 1);
              setSelectedDate(newDate);
            }}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Следующий →
          </button>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((day) => (
            <div key={day} className="text-center font-semibold text-gray-600 py-2">
              {day}
            </div>
          ))}

          {days.map((day) => {
            const dayLessons = getLessonsForDay(day);
            return (
              <div
                key={day.toISOString()}
                className="border border-gray-200 rounded-lg p-2 min-h-24 hover:bg-gray-50"
              >
                <div className="text-sm text-gray-600 mb-1">{day.getDate()}</div>
                {dayLessons.length > 0 && (
                  <div className="space-y-1">
                    {dayLessons.map((lesson) => (
                      <div
                        key={lesson.id}
                        className={`text-xs rounded px-2 py-1 cursor-pointer border ${getStatusColor(lesson.status)}`}
                        onClick={() => {
                          setSelectedLesson(lesson);
                          setShowLessonDetailsModal(true);
                        }}
                        title={`${lesson.client.fullName} - ${getStatusText(lesson.status)}`}
                      >
                        <div className="font-semibold">
                          {formatLessonTime(lesson.startTime, lesson.durationMin)}
                        </div>
                        <div className="truncate">{lesson.client.fullName}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Модальное окно деталей занятия */}
      {showLessonDetailsModal && selectedLesson && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Детали занятия</h2>
              <button onClick={() => setShowLessonDetailsModal(false)}>
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">Клиент</p>
                <p className="font-semibold">{selectedLesson.client.fullName}</p>
              </div>

              <div>
                <p className="text-sm text-gray-600">Время</p>
                <p className="font-semibold">
                  {new Date(selectedLesson.startTime).toLocaleString('ru-RU')}
                </p>
                <p className="text-sm">{formatLessonTime(selectedLesson.startTime, selectedLesson.durationMin)}</p>
              </div>

              <div>
                <p className="text-sm text-gray-600">Тип</p>
                <p className="font-semibold">{selectedLesson.type}</p>
              </div>

              <div>
                <p className="text-sm text-gray-600">Длительность</p>
                <p className="font-semibold">{selectedLesson.durationMin} мин</p>
              </div>

              <div>
                <p className="text-sm text-gray-600">Статус</p>
                <p className={`font-semibold ${
                  selectedLesson.status === 'DONE' ? 'text-green-600' : 
                  selectedLesson.status === 'CANCELLED' ? 'text-red-600' : 
                  'text-blue-600'
                }`}>
                  {getStatusText(selectedLesson.status)}
                </p>
              </div>

              {selectedLesson.notes && (
                <div>
                  <p className="text-sm text-gray-600">Примечание</p>
                  <p className="text-sm">{selectedLesson.notes}</p>
                </div>
              )}

              <div className="flex gap-2 pt-4 border-t">
                <button
                  onClick={() => updateLessonStatus(selectedLesson.id, 'DONE')}
                  disabled={selectedLesson.status === 'DONE'}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    selectedLesson.status === 'DONE'
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
                >
                  <Check className="w-5 h-5" />
                  Проведено
                </button>
                <button
                  onClick={() => updateLessonStatus(selectedLesson.id, 'CANCELLED')}
                  disabled={selectedLesson.status === 'CANCELLED'}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    selectedLesson.status === 'CANCELLED'
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-red-600 text-white hover:bg-red-700'
                  }`}
                >
                  <XCircle className="w-5 h-5" />
                  Отменено
                </button>
              </div>

              {(selectedLesson.status === 'DONE' || selectedLesson.status === 'CANCELLED') && (
                <>
                  <button
                    onClick={() => updateLessonStatus(selectedLesson.id, 'PLANNED')}
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                  >
                    <Edit className="w-5 h-5" />
                    Вернуть в запланированные
                  </button>
                  <button
                    onClick={() => deleteLesson(selectedLesson.id)}
                    className="w-full flex items-center justify-center gap-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 mt-2"
                  >
                    <Trash2 className="w-5 h-5" />
                    Удалить занятие
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно создания занятия */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Новое занятие</h2>
              <button onClick={() => setShowModal(false)}>
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-semibold mb-2">Клиент</label>
                <select
                  value={formData.clientId}
                  onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                >
                  <option value="">Выберите клиента</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.fullName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-semibold mb-2">Дата занятия</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-semibold mb-2">Время начала</label>
                <input
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-semibold mb-2">Длительность</label>
                <select
                  value={formData.durationMin}
                  onChange={(e) => setFormData({ ...formData, durationMin: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border rounded-lg"
                >
                  <option value="30">30 минут</option>
                  <option value="45">45 минут</option>
                  <option value="60">1 час</option>
                  <option value="90">1.5 часа</option>
                  <option value="120">2 часа</option>
                  <option value="150">2.5 часа</option>
                  <option value="180">3 часа</option>
                </select>
                {formData.date && formData.startTime && (
                  <p className="text-xs text-gray-500 mt-1">
                    Окончание: {calculateEndTime(formData.date, formData.startTime, formData.durationMin)}
                  </p>
                )}
              </div>

              <div className="mb-4">
                <label className="block text-sm font-semibold mb-2">Тип</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                >
                  <option value="Индивидуальное">Индивидуальное</option>
                  <option value="Групповое">Групповое</option>
                  <option value="Пробное">Пробное</option>
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-semibold mb-2">Примечание</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="Дополнительная информация..."
                />
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Создать занятие
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}