import { useEffect, useState } from 'react';
import axios from 'axios';
import { Plus, X } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://192.168.56.104:4000';

interface Payment {
  id: number;
  amount: string;
  method: string;
  dateTime: string;
  note?: string;
  client: { fullName: string };
  lesson?: { id: number; startTime: string };
}

interface Client {
  id: number;
  fullName: string;
}

interface Lesson {
  id: number;
  startTime: string;
  type: string;
  client: { fullName: string };
}

export default function Payments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [filteredLessons, setFilteredLessons] = useState<Lesson[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    clientId: '',
    lessonId: '',
    amount: '',
    method: 'Наличные',
    dateTime: new Date().toISOString().slice(0, 16),
    note: '',
  });

  useEffect(() => {
    fetchPayments();
    fetchClients();
    fetchLessons();
  }, []);

  const fetchPayments = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/payments`);
      setPayments(response.data);
    } catch (error) {
      console.error('Failed to fetch payments:', error);
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

  const fetchLessons = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/lessons`);
      setLessons(response.data);
    } catch (error) {
      console.error('Failed to fetch lessons:', error);
    }
  };

  // Фильтруем уроки по выбранному клиенту
  useEffect(() => {
    if (formData.clientId) {
      const clientLessons = lessons.filter(
        (lesson) => lesson.client && lesson.client.fullName === clients.find(c => c.id === parseInt(formData.clientId))?.fullName
      );
      setFilteredLessons(clientLessons);
    } else {
      setFilteredLessons([]);
    }
  }, [formData.clientId, lessons, clients]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const submitData: any = {
        clientId: parseInt(formData.clientId),
        amount: parseFloat(formData.amount),
        method: formData.method,
        dateTime: formData.dateTime,
        note: formData.note,
      };

      // Добавляем lessonId только если он выбран
      if (formData.lessonId) {
        submitData.lessonId = parseInt(formData.lessonId);
      }

      await axios.post(`${API_URL}/api/payments`, submitData);
      setShowModal(false);
      fetchPayments();
      resetForm();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Ошибка создания платежа');
    }
  };

  const resetForm = () => {
    setFormData({
      clientId: '',
      lessonId: '',
      amount: '',
      method: 'Наличные',
      dateTime: new Date().toISOString().slice(0, 16),
      note: '',
    });
    setFilteredLessons([]);
  };

  const totalAmount = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);

  const formatLessonForSelect = (lesson: Lesson) => {
    const date = new Date(lesson.startTime);
    return `${date.toLocaleDateString('ru-RU')} ${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} - ${lesson.type}`;
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Платежи</h1>
          <p className="text-gray-600 mt-2">
            Всего: <span className="font-bold text-green-600">{totalAmount.toFixed(2)} ₽</span>
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          Добавить платёж
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Дата</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Клиент</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Урок</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Сумма</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Метод</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Примечание</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {payments.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                  Платежи отсутствуют
                </td>
              </tr>
            ) : (
              payments.map((payment) => (
                <tr key={payment.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {new Date(payment.dateTime).toLocaleString('ru-RU')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{payment.client.fullName}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {payment.lesson ? 
                      new Date(payment.lesson.startTime).toLocaleString('ru-RU', { 
                        day: '2-digit', 
                        month: '2-digit', 
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      }) 
                      : '—'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap font-semibold text-green-600">
                    {parseFloat(payment.amount).toFixed(2)} ₽
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{payment.method}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{payment.note || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Новый платёж</h2>
              <button onClick={() => { setShowModal(false); resetForm(); }}>
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-semibold mb-2">Клиент *</label>
                <select
                  value={formData.clientId}
                  onChange={(e) => setFormData({ ...formData, clientId: e.target.value, lessonId: '' })}
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
                <label className="block text-sm font-semibold mb-2">
                  Урок (необязательно)
                </label>
                <select
                  value={formData.lessonId}
                  onChange={(e) => setFormData({ ...formData, lessonId: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  disabled={!formData.clientId}
                >
                  <option value="">Без привязки к уроку</option>
                  {filteredLessons.map((lesson) => (
                    <option key={lesson.id} value={lesson.id}>
                      {formatLessonForSelect(lesson)}
                    </option>
                  ))}
                </select>
                {!formData.clientId && (
                  <p className="text-xs text-gray-500 mt-1">Сначала выберите клиента</p>
                )}
              </div>

              <div className="mb-4">
                <label className="block text-sm font-semibold mb-2">Сумма (₽) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-semibold mb-2">Метод оплаты</label>
                <select
                  value={formData.method}
                  onChange={(e) => setFormData({ ...formData, method: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                >
                  <option>Наличные</option>
                  <option>Карта</option>
                  <option>Перевод</option>
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-semibold mb-2">Дата и время</label>
                <input
                  type="datetime-local"
                  value={formData.dateTime}
                  onChange={(e) => setFormData({ ...formData, dateTime: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-semibold mb-2">Примечание</label>
                <textarea
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
              >
                Создать
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}