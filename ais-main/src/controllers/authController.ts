import { Request, Response } from 'express';
import prisma from '../utils/prismaClient';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export async function register(req: Request, res: Response) {
  try {
    console.log('🔧 [Auth.register] Регистрация нового пользователя');
    
    const { email, password, fullName, role = 'TEACHER' } = req.body;

    if (!email || !password) {
      console.log('❌ [Auth.register] Отсутствует email или пароль');
      return res.status(400).json({ error: 'Email и пароль обязательны' });
    }

    // Проверка email формата
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.log('❌ [Auth.register] Некорректный формат email:', email);
      return res.status(400).json({ error: 'Некорректный формат email' });
    }

    // Проверка длины пароля
    if (password.length < 6) {
      return res.status(400).json({ error: 'Пароль должен содержать минимум 6 символов' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      console.log('❌ [Auth.register] Пользователь уже существует:', email);
      return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName: fullName || null,
        role: role as 'ADMIN' | 'TEACHER',
      },
    });

    // Создаем токен с правильной структурой
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email,
        role: user.role,
        fullName: user.fullName 
      }, 
      JWT_SECRET, 
      { expiresIn: '7d' }
    );

    console.log(`✅ [Auth.register] Пользователь создан: ${user.email} (ID: ${user.id})`);

    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        createdAt: user.createdAt,
      },
    });
  } catch (err: any) {
    console.error('❌ [Auth.register] Ошибка регистрации:', err);
    res.status(500).json({ 
      error: 'Ошибка при регистрации', 
      details: err.message 
    });
  }
}

export async function login(req: Request, res: Response) {
  try {
    console.log('🔧 [Auth.login] Попытка входа');
    
    const { email, password } = req.body;

    if (!email || !password) {
      console.log('❌ [Auth.login] Отсутствует email или пароль');
      return res.status(400).json({ error: 'Email и пароль обязательны' });
    }

    const user = await prisma.user.findUnique({ 
      where: { email },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        fullName: true,
        role: true,
        createdAt: true,
      }
    });
    
    if (!user) {
      console.log('❌ [Auth.login] Пользователь не найден:', email);
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      console.log('❌ [Auth.login] Неверный пароль для пользователя:', email);
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    // Создаем токен (не включаем passwordHash в payload!)
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email,
        role: user.role,
        fullName: user.fullName 
      }, 
      JWT_SECRET, 
      { expiresIn: '7d' }
    );

    console.log(`✅ [Auth.login] Успешный вход: ${user.email} (ID: ${user.id})`);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        createdAt: user.createdAt,
      },
    });
  } catch (err: any) {
    console.error('❌ [Auth.login] Ошибка входа:', err);
    res.status(500).json({ 
      error: 'Ошибка при входе', 
      details: err.message 
    });
  }
}

export async function getMe(req: Request, res: Response) {
  try {
    console.log('🔧 [Auth.getMe] Запрос данных пользователя');
    
    // Используем req.userId вместо (req as any).userId
    const userId = req.userId;
    
    console.log('🔧 [getMe] userId из middleware:', userId);
    
    if (!userId) {
      console.log('❌ [getMe] userId не найден в запросе');
      return res.status(401).json({ 
        error: 'Не авторизован',
        details: 'Токен не содержит идентификатор пользователя'
      });
    }

    const user = await prisma.user.findUnique({ 
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      }
    });

    if (!user) {
      console.log('❌ [getMe] Пользователь не найден в БД:', userId);
      return res.status(404).json({ 
        error: 'Пользователь не найден',
        details: 'Пользователь был удален или не существует'
      });
    }

    console.log(`✅ [getMe] Данные пользователя отправлены: ${user.email}`);
    
    res.json(user);
  } catch (err: any) {
    console.error('❌ [Auth.getMe] Ошибка получения данных пользователя:', err);
    res.status(500).json({ 
      error: 'Ошибка получения данных пользователя', 
      details: err.message 
    });
  }
}