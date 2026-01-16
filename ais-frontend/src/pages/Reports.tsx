import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { Download, RefreshCw } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://192.168.56.104:4000';

export default function Reports() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [lessons, setLessons] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [stats, setStats] = useState({
    totalLessons: 0,
    completedLessons: 0,
    cancelledLessons: 0,
    totalRevenue: 0,
  });
  const [payments, setPayments] = useState<any[]>([]);

  useEffect(() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    setDateFrom(firstDay.toISOString().split('T')[0]);
    setDateTo(now.toISOString().split('T')[0]);
  }, []);

  const fetchData = useCallback(async () => {
    if (!dateFrom || !dateTo) return;
    
    setLoading(true);
    try {
      console.log('📄 Обновление данных отчетов...');
      
      const [lessonsRes, paymentsRes] = await Promise.all([
        axios.get(`${API_URL}/api/lessons`),
        axios.get(`${API_URL}/api/payments`)
      ]);

      console.log(`✅ Загружено ${lessonsRes.data.length} занятий`);
      console.log(`💰 Загружено ${paymentsRes.data.length} платежей`);
      console.log(`📊 Статусы занятий:`, {
        planned: lessonsRes.data.filter((l: any) => l.status === 'PLANNED').length,
        done: lessonsRes.data.filter((l: any) => l.status === 'DONE').length,
        cancelled: lessonsRes.data.filter((l: any) => l.status === 'CANCELLED').length,
      });

      const from = new Date(dateFrom);
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);

      const filteredLessons = lessonsRes.data.filter((l: any) => {
        const date = new Date(l.startTime);
        return date >= from && date <= to;
      });

      console.log(`📊 Отфильтровано занятий за период: ${filteredLessons.length}`);
      console.log(`   - Проведено: ${filteredLessons.filter((l: any) => l.status === 'DONE').length}`);
      console.log(`   - Отменено: ${filteredLessons.filter((l: any) => l.status === 'CANCELLED').length}`);

      setLessons(filteredLessons);
      setPayments(paymentsRes.data);

      // Подсчитываем общую выручку за период
      let totalRevenue = 0;
      filteredLessons.forEach((lesson: any) => {
        const lessonPayments = paymentsRes.data.filter((p: any) => p.lessonId === lesson.id);
        lessonPayments.forEach((payment: any) => {
          totalRevenue += parseFloat(payment.amount);
        });
      });

      const newStats = {
        totalLessons: filteredLessons.length,
        completedLessons: filteredLessons.filter((l: any) => l.status === 'DONE').length,
        cancelledLessons: filteredLessons.filter((l: any) => l.status === 'CANCELLED').length,
        totalRevenue: totalRevenue,
      };
      
      setStats(newStats);
      setLastUpdate(new Date());
      
      console.log('✅ Статистика обновлена:', newStats);
    } catch (error) {
      console.error('❌ Ошибка загрузки данных отчетов:', error);
      alert('Ошибка при загрузке данных отчетов');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    if (dateFrom && dateTo) {
      fetchData();
    }
  }, [dateFrom, dateTo, fetchData]);

  useEffect(() => {
    const handleFocus = () => {
      console.log('👁️ Страница отчетов получила фокус, обновляем данные...');
      fetchData();
    };

    window.addEventListener('focus', handleFocus);
    fetchData();

    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchData]);

  const getLessonTypeText = (type: string): string => {
    const typeMap: Record<string, string> = {
      'INDIVIDUAL': 'Индивидуальное',
      'GROUP': 'Групповое',
      'TRIAL': 'Пробное',
      'Индивидуальное': 'Индивидуальное',
      'Групповое': 'Групповое',
      'Пробное': 'Пробное'
    };
    return typeMap[type] || type;
  };

  const getLessonStatusText = (status: string): string => {
    const statusMap: Record<string, string> = {
      'PLANNED': 'Запланировано',
      'DONE': 'Проведено',
      'CANCELLED': 'Отменено'
    };
    return statusMap[status] || status;
  };

  const formatLessonTime = (startTime: string, durationMin: number) => {
    const start = new Date(startTime);
    const end = new Date(start.getTime() + durationMin * 60 * 1000);
    
    const startStr = start.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    const endStr = end.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    
    return `${startStr} - ${endStr}`;
  };

  const getPaymentAmount = (lessonId: number): string => {
    const lessonPayments = payments.filter((p: any) => p.lessonId === lessonId);
    if (lessonPayments.length === 0) return '0';
    const total = lessonPayments.reduce((sum: number, p: any) => sum + parseFloat(p.amount), 0);
    return total.toFixed(2);
  };

  const exportCSV = () => {
    console.log('📥 Экспорт CSV. Всего занятий:', lessons.length);
    
    const allLessonsData = lessons.map((lesson) => {
      return {
        date: new Date(lesson.startTime).toLocaleDateString('ru-RU'),
        time: formatLessonTime(lesson.startTime, lesson.durationMin),
        client: lesson.client?.fullName || 'Не указан',
        type: getLessonTypeText(lesson.type),
        status: getLessonStatusText(lesson.status),
        paymentAmount: getPaymentAmount(lesson.id),
      };
    });

    allLessonsData.sort((a, b) => {
      const dateA = a.date.split('.').reverse().join('-');
      const dateB = b.date.split('.').reverse().join('-');
      return dateA.localeCompare(dateB);
    });

    const headers = ['Дата', 'Время', 'Клиент', 'Тип занятия', 'Статус занятия', 'Сумма оплаты'];

    const rows = allLessonsData.map(item => [
      item.date,
      item.time,
      item.client,
      item.type,
      item.status,
      item.paymentAmount,
    ]);

    const csvContent = [
      `Отчет за период ${formatDate(dateFrom)} — ${formatDate(dateTo)}`,
      `Всего занятий: ${lessons.length}`,
      `Проведено: ${stats.completedLessons}`,
      `Отменено: ${stats.cancelledLessons}`,
      `Общая выручка: ${stats.totalRevenue.toFixed(2)} ₽`,
      '',
      headers.join(';'),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(';'))
    ].join('\r\n');

    console.log(`📊 CSV содержит ${rows.length} строк данных`);

    const blob = new Blob(['\ufeff' + csvContent], { 
      type: 'text/csv;charset=utf-8;' 
    });
    
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `Отчет_${formatDate(dateFrom)}_${formatDate(dateTo)}.csv`);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    console.log('✅ CSV файл загружен');
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Отчёты</h1>
          {lastUpdate && (
            <p className="text-sm text-gray-500 mt-1">
              Последнее обновление: {lastUpdate.toLocaleTimeString('ru-RU')}
            </p>
          )}
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors disabled:bg-gray-400"
          title="Обновить данные"
        >
          <RefreshCw className={`w-5 h-5 mr-2 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Обновление...' : 'Обновить'}
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-semibold mb-2">Дата с</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-2">Дата по</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg"
            />
          </div>
        </div>

        <button
          onClick={exportCSV}
          disabled={lessons.length === 0}
          className="flex items-center bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          <Download className="w-5 h-5 mr-2" />
          Экспорт в CSV ({lessons.length} занятий)
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600 text-sm">Всего занятий</p>
          <p className="text-3xl font-bold text-blue-600 mt-2">{stats.totalLessons}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600 text-sm">Завершённые</p>
          <p className="text-3xl font-bold text-green-600 mt-2">{stats.completedLessons}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600 text-sm">Отменённые</p>
          <p className="text-3xl font-bold text-red-600 mt-2">{stats.cancelledLessons}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600 text-sm">Общая выручка</p>
          <p className="text-3xl font-bold text-green-600 mt-2">{stats.totalRevenue.toFixed(2)} ₽</p>
        </div>
      </div>

      {/* Таблица всех занятий */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center justify-between">
          <span>Все занятия за период ({lessons.length})</span>
          {loading && <span className="text-sm text-gray-500">Загрузка...</span>}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Дата</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Время</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Клиент</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Тип</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Статус</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Сумма оплаты</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {lessons.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    За выбранный период нет занятий
                  </td>
                </tr>
              ) : (
                lessons.map((lesson) => {
                  const paymentAmount = getPaymentAmount(lesson.id);
                  
                  return (
                    <tr key={lesson.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">
                        {new Date(lesson.startTime).toLocaleDateString('ru-RU')}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {formatLessonTime(lesson.startTime, lesson.durationMin)}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium">
                        {lesson.client?.fullName}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {getLessonTypeText(lesson.type)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          lesson.status === 'DONE'
                            ? 'bg-green-100 text-green-800'
                            : lesson.status === 'CANCELLED'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {getLessonStatusText(lesson.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-green-600">
                        {paymentAmount} ₽
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}