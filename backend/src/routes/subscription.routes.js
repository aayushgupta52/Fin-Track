import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.js';
import { idParamSchema } from '../validators/common.validator.js';
import {
  createSubscriptionSchema,
  updateSubscriptionSchema,
  upcomingQuerySchema,
} from '../validators/subscription.validator.js';
import {
  listSubscriptions,
  createSubscription,
  updateSubscription,
  deleteSubscription,
  upcomingSubscriptions,
} from '../controllers/subscription.controller.js';

const router = Router();

router.use(authenticateJWT);

// /upcoming before /:id so it isn't captured as an id.
router.get('/upcoming', validate(upcomingQuerySchema, 'query'), upcomingSubscriptions);

router.get('/', listSubscriptions);
router.post('/', validate(createSubscriptionSchema), createSubscription);

router.put(
  '/:id',
  validate(idParamSchema, 'params'),
  validate(updateSubscriptionSchema),
  updateSubscription
);
router.delete('/:id', validate(idParamSchema, 'params'), deleteSubscription);

export default router;
