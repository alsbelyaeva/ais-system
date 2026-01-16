// src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      user?: {
        id: string;
        email: string;
        role: string;
        fullName?: string;
      };
    }
  }
}


export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  // ============ СПИСОК ПУБЛИЧНЫХ МАРШРУТОВ ============
  const publicRoutes = [
    '/api/register',
    '/register',
    '/api/login',
    '/login',
    '/api/auth/login',
    '/auth/login'
  ];
  
  // Проверяем, является ли текущий путь публичным
  if (publicRoutes.includes(req.path)) {
    console.log(`✅ [AuthMiddleware] Публичный маршрут ${req.path}, пропускаем проверку`);
    return next(); // Пропускаем без проверки авторизации
  }
  // ====================================================
  
  try {
    console.log('🔧 [AuthMiddleware] Проверка авторизации для:', req.path);
    console.log('🔧 [AuthMiddleware] Полные headers:', {
      authorization: req.headers.authorization,
      'content-type': req.headers['content-type']
    });
    
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ [AuthMiddleware] Нет токена авторизации');
      return res.status(401).json({ 
        error: 'Не авторизован',
        details: 'Требуется токен авторизации в формате: Bearer <token>'
      });
    }

    const token = authHeader.substring(7);
    
    if (!token || token.trim() === '') {
      console.log('❌ [AuthMiddleware] Пустой токен после Bearer');
      return res.status(401).json({ error: 'Пустой токен' });
    }

    // Проверяем токен
    console.log('🔧 [AuthMiddleware] Проверка токена:', token.substring(0, 20) + '...');
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    console.log('✅ [AuthMiddleware] Токен валиден. Payload:', {
      id: decoded.id,
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      fullName: decoded.fullName
    });
    
    // Ищем ID пользователя в разных полях
    const userId = decoded.id || decoded.userId || decoded.sub;
    
    if (!userId) {
      console.log('❌ [AuthMiddleware] ID пользователя не найден в токене');
      console.log('❌ Полный decoded:', decoded);
      return res.status(401).json({ 
        error: 'Неверный токен',
        details: 'ID пользователя не найден в токене. Токен должен содержать поле id или userId'
      });
    }

    if (typeof userId !== 'string') {
      console.log('❌ [AuthMiddleware] ID пользователя не строка:', typeof userId);
      return res.status(401).json({ 
        error: 'Неверный формат токена',
        details: 'ID пользователя должен быть строкой'
      });
    }

    // Сохраняем userId в request
    (req as any).userId = userId;
    req.userId = userId;
    
    // Также сохраняем полные данные пользователя
    req.user = {
      id: userId,
      email: decoded.email || '',
      role: decoded.role || 'TEACHER',
      fullName: decoded.fullName
    };
    
    console.log(`✅ [AuthMiddleware] Пользователь авторизован:`, {
      userId: req.userId,
      email: req.user?.email,
      role: req.user?.role
    });
    
    next();
  } catch (err: any) {
    console.error('❌ [AuthMiddleware] Ошибка проверки токена:', {
      name: err.name,
      message: err.message,
      stack: err.stack
    });
    
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Токен истек',
        details: 'Срок действия токена истек. Пожалуйста, войдите снова.'
      });
    }
    
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: 'Неверный токен',
        details: 'Токен поврежден или недействителен'
      });
    }
    
    return res.status(500).json({ 
      error: 'Ошибка аутентификации',
      details: err.message 
    });
  }
}

export function requireRole(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Не авторизован' });
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Доступ запрещен',
        details: `Требуемая роль: ${allowedRoles.join(', ')}. Ваша роль: ${req.user.role}`
      });
    }
    
    next();
  };
}

export function debugAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  console.log('🔧 [DebugAuth] Запрос к:', req.path);
  console.log('🔧 [DebugAuth] Метод:', req.method);
  console.log('🔧 [DebugAuth] Заголовки:', req.headers);
  
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    console.log('🔧 [DebugAuth] Токен получен, пытаемся декодировать...');
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      console.log('✅ [DebugAuth] Токен декодирован:', decoded);
      
      const userId = decoded.id || decoded.userId;
      if (userId) {
        req.userId = userId;
        req.user = {
          id: userId,
          email: decoded.email || '',
          role: decoded.role || 'TEACHER'
        };
        console.log(`✅ [DebugAuth] Установлен пользователь: ${userId}`);
      }
    } catch (error) {
      console.log('⚠️ [DebugAuth] Токен невалиден, но продолжаем в отладочном режиме');
    }
  }
  
  // В отладочном режиме всегда разрешаем доступ
  if (!req.userId) {
    req.userId = 'debug-user-id';
    req.user = {
      id: 'debug-user-id',
      email: 'debug@example.com',
      role: 'TEACHER'
    };
    console.log('⚠️ [DebugAuth] Установлен debug пользователь');
  }
  
  next();
}