import express from 'express';
import { getQrToken, getDisplayInfo } from '../controllers/displayController.js';
import { authenticateDevice } from '../middleware/deviceAuth.js';

const router = express.Router();

// 5.1 QR issue endpoint (Device authenticated)
router.get('/qr', authenticateDevice, getQrToken);

// Kiosk metadata endpoint (Public read for kiosk headers)
router.get('/info/:deviceId', getDisplayInfo);

export default router;
