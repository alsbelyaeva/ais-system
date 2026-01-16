// src/pages/Dashboard.tsx
import { useEffect, useState } from 'react';
import axios from 'axios';
import { Users, Calendar, DollarSign, TrendingUp } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://192.168.56.104:4000';

interface Stats {
  totalClients: number;
  upcomingLessons: number;
  monthlyRevenue: number;
  activeRequests: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    totalClients: 0,
    upcomingLessons: 0,
    monthlyRevenue: 0,
    activeRequests: 0,
  });
  const [recentLessons, setRecentLessons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [clientsRes, lessonsRes, paymentsRes, requestsRes] = await Promise.all([
        axios.get(`${API_URL}/api/clients`),
        axios.get(`${API_URL}/api/lessons`),
        axios.get(`${API_URL}/api/payments`),
        axios.get(`${API_URL}/api/slot-requests`),
      ]);

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const upcoming = lessonsRes.data.filter((l: any) => 
        new Date(l.startTime) > now && l.status === 'PLANNED'
      );

      const monthPayments = paymentsRes.data.filter((p: any) => 
        new Date(p.dateTime) >= monthStart
      );

      const revenue = monthPayments.reduce((sum: number, p: any) => 
        sum + parseFloat(p.amount), 0
      );

      setStats({
        totalClients: clientsRes.data.length,
        upcomingLessons: upcoming.length,
        monthlyRevenue: revenue,
        activeRequests: requestsRes.data.filter((r: any) => r.status === 'NEW').length,
      });

      setRecentLessons(
        lessonsRes.data
          .sort((a: any, b: any) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
          .slice(0, 5)
      );
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { title: 'Всего клиентов', value: stats.totalClients, icon: Users, color: 'blue' },
    { title: 'Предстоящие занятия', value: stats.upcomingLessons, icon: Calendar, color: 'green' },
    { title: 'Доход за месяц', value: `${stats.monthlyRevenue.toFixed(2)} ₽`, icon: DollarSign, color: 'purple' },
    { title: 'Активные запросы', value: stats.activeRequests, icon: TrendingUp, color: 'orange' },
  ];

  if (loading) {
    return <div className="text-center py-12">Загрузка...</div>;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-800 mb-8">Обзор</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((card) => (
          <div key={card.title} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">{card.title}</p>
                <p className="text-2xl font-bold text-gray-800 mt-1">{card.value}</p>
              </div>
              <div className={`bg-${card.color}-100 p-3 rounded-full`}>
                <card.icon className={`w-6 h-6 text-${card.color}-600`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-800">Последние занятия</h2>
        </div>
        <div className="p-6">
          {recentLessons.length === 0 ? (
            <p className="text-gray-600">Нет занятий</p>
          ) : (
            <div className="space-y-4">
              {recentLessons.map((lesson) => (
                <div key={lesson.id} className="flex items-center justify-between border-b pb-4">
                  <div>
                    <p className="font-semibold text-gray-800">
                      {lesson.client?.fullName || 'Неизвестный клиент'}
                    </p>
                    <p className="text-sm text-gray-600">
                      {new Date(lesson.startTime).toLocaleString('ru-RU')} • {lesson.durationMin} мин
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-sm ${
                      lesson.status === 'DONE'
                        ? 'bg-green-100 text-green-800'
                        : lesson.status === 'PLANNED'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {lesson.status === 'DONE' ? 'Проведено' : lesson.status === 'PLANNED' ? 'Запланировано' : 'Отменено'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}