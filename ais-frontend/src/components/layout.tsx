// src/components/Layout.tsx
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  Home, 
  Users, 
  Calendar as CalendarIcon, 
  DollarSign, 
  Clock, 
  Settings as SettingsIcon,
  FileText,
  LogOut,
  Info as InfoIcon
} from 'lucide-react';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems = [
    { path: '/', icon: Home, label: 'Обзор' },
    { path: '/clients', icon: Users, label: 'Клиенты' },
    { path: '/calendar', icon: CalendarIcon, label: 'Расписание' },
    { path: '/payments', icon: DollarSign, label: 'Платежи' },
    { path: '/slot-requests', icon: Clock, label: 'Запросы слотов' },
    { path: '/reports', icon: FileText, label: 'Отчёты' },
    { path: '/settings', icon: SettingsIcon, label: 'Настройки' },
    { path: '/info', icon: InfoIcon, label: 'О программе' },
  ];

  // Добавляем пункт для администраторов
  const adminMenuItems = [
    { path: '/admin/users', icon: Users, label: 'Пользователи', adminOnly: true }
  ];

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-white shadow-md">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-gray-800">CRM Система</h1>
          <p className="text-sm text-gray-600 mt-1">{user?.fullName || user?.email}</p>
          <span className="inline-block mt-2 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
            {user?.role === 'ADMIN' ? 'Администратор' : 'Преподаватель'}
          </span>
        </div>

        <nav className="mt-6">
          {/* Основные пункты меню */}
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className="flex items-center px-6 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"
            >
              <item.icon className="w-5 h-5 mr-3" />
              {item.label}
            </Link>
          ))}
          
          {/* Пункты только для администратора */}
          {user?.role === 'ADMIN' && (
            <>
              <div className="px-6 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Администрирование
              </div>
              {adminMenuItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className="flex items-center px-6 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                >
                  <item.icon className="w-5 h-5 mr-3" />
                  {item.label}
                </Link>
              ))}
            </>
          )}
        </nav>

        <div className="absolute bottom-0 w-64 p-6">
          <button
            onClick={handleLogout}
            className="flex items-center w-full px-4 py-2 text-gray-700 hover:bg-red-50 hover:text-red-600 rounded transition-colors"
          >
            <LogOut className="w-5 h-5 mr-3" />
            Выйти
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-8">
        <Outlet />
      </main>
    </div>
  );
}