import { Router } from 'express';
import authRoutes from './auth.routes.js';
import expenseRoutes from './expense.routes.js';
import incomeRoutes from './income.routes.js';
import budgetRoutes from './budget.routes.js';
import subscriptionRoutes from './subscription.routes.js';
import aiRoutes from './ai.routes.js';
import documentRoutes from './document.routes.js';
import notificationRoutes from './notification.routes.js';
import reportRoutes from './report.routes.js';
import splitRoutes from './split.routes.js';
import whatsappRoutes from '../whatsapp/whatsapp.routes.js';
import adminRoutes from './admin.routes.js';

const router = Router();

router.get('/health', (_req, res) =>
  res.json({ success: true, message: 'API healthy', uptime: process.uptime() })
);

router.use('/auth', authRoutes);
router.use('/expenses', expenseRoutes);
router.use('/income', incomeRoutes);
router.use('/budgets', budgetRoutes);
router.use('/subscriptions', subscriptionRoutes);
router.use('/ai', aiRoutes);
router.use('/documents', documentRoutes);
router.use('/notifications', notificationRoutes);
router.use('/reports', reportRoutes);
router.use('/split', splitRoutes);
router.use('/whatsapp', whatsappRoutes);
router.use('/admin', adminRoutes);

export default router;
