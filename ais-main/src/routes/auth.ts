import { Router } from 'express';
import * as ctrl from '../controllers/authController';
import { authMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);
router.post('/register', ctrl.register);
router.post('/login', ctrl.login);
router.get('/me', authMiddleware, ctrl.getMe);

export default router;