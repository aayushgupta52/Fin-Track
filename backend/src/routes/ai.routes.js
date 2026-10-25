import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.js';
import {
  categorizeSchema,
  chatSchema,
  periodQuerySchema,
} from '../validators/ai.validator.js';
import {
  categorize,
  insights,
  healthScore,
  taxSuggestions,
  chat,
} from '../controllers/ai.controller.js';

const router = Router();

router.use(authenticateJWT);

router.post('/categorize', validate(categorizeSchema), categorize);
router.get('/insights', validate(periodQuerySchema, 'query'), insights);
router.get('/health-score', validate(periodQuerySchema, 'query'), healthScore);
router.get('/tax-suggestions', taxSuggestions);
router.post('/chat', validate(chatSchema), chat);

export default router;
