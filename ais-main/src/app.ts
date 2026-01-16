import express from 'express';
import cors from 'cors';
import authRouter from './routes/auth';
import usersRouter from './routes/users';
import clientsRouter from './routes/clients';
import lessonsRouter from './routes/lessons';
import paymentsRouter from './routes/payments';
import slotRequestsRouter from './routes/slotRequests';
import slotWeightsRouter from './routes/slotWeights';
import auditLogsRouter from './routes/auditLogs';
import slotRankingRouter from './routes/slotRanking';
import adminClientsRouter from './routes/adminRoutes';
import { authMiddleware } from './middleware/auth';
const app = express();

// Swagger docs
import { setupSwagger } from './utils/swagger';
setupSwagger(app);



// ИЛИ конкретные origins
app.use(cors({
  origin: ['http://localhost:5173', 'http://192.168.31.106:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
// Middleware
app.use(express.json());

// Health check (для проверки)
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Middleware
app.use(cors());
app.use(express.json());


// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message 
  });
});

 import adminRoutes from './routes/adminRoutes';
   app.use(adminRoutes);
// Routes
app.use('/api/auth', authRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/slots', slotRankingRouter);
app.use('/api/admin', adminClientsRouter);
app.use('/api/clients', authMiddleware, clientsRouter); // Обычные клиенты (фильтруются по роли)
app.use('/api/lessons', authMiddleware, lessonsRouter); // Уроки (фильтруются по роли)
app.use('/api/slot-requests', authMiddleware, slotRequestsRouter);
app.use('/api/slot-weights', authMiddleware, slotWeightsRouter);
app.use('/api/audit-logs', authMiddleware, auditLogsRouter);
app.use('/api/users', authMiddleware, usersRouter);

// Админские маршруты (нужен authMiddleware + проверка роли в самих роутерах)
app.use('/api/admin', adminClientsRouter);
export default app;