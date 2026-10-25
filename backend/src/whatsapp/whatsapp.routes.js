// WhatsApp routes — a small, authenticated surface for the frontend to poll the
// connection state. The QR itself is rendered in the server terminal (see
// whatsapp.service.js); this endpoint just reports status.

import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth.middleware.js';
import { ok, asyncHandler } from '../utils/response.js';
import { getWhatsAppStatus } from './whatsapp.service.js';

const router = Router();

router.use(authenticateJWT);

// GET /api/whatsapp/status → { enabled, status, connected, qr }
router.get(
  '/status',
  asyncHandler(async (_req, res) => ok(res, getWhatsAppStatus()))
);

export default router;
