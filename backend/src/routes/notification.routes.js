import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.js';
import { idParamSchema } from '../validators/common.validator.js';
import { listNotificationsQuery } from '../validators/notification.validator.js';
import {
  listNotifications,
  markRead,
  markAllRead,
  deleteNotification,
} from '../controllers/notification.controller.js';

const router = Router();

router.use(authenticateJWT);

router.get('/', validate(listNotificationsQuery, 'query'), listNotifications);
router.put('/read-all', markAllRead);
router.put('/:id/read', validate(idParamSchema, 'params'), markRead);
router.delete('/:id', validate(idParamSchema, 'params'), deleteNotification);

export default router;
