import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth.middleware.js';
import { uploadLimiter } from '../middleware/rateLimiter.js';
import { uploadSingle } from '../middleware/upload.js';
import { validate } from '../middleware/validate.js';
import { idParamSchema } from '../validators/common.validator.js';
import {
  uploadDocument,
  listDocuments,
  documentStatus,
  reprocessDocument,
} from '../controllers/document.controller.js';

const router = Router();

router.use(authenticateJWT);

router.post('/upload', uploadLimiter, uploadSingle, uploadDocument);
router.get('/', listDocuments);
router.get('/:id/status', validate(idParamSchema, 'params'), documentStatus);
router.post('/:id/reprocess', validate(idParamSchema, 'params'), reprocessDocument);

export default router;
