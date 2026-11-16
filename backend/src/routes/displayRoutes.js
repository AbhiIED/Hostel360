import express from 'express';
import { getQrToken, getDisplayInfo, getKioskQrToken } from '../controllers/displayController.js';
import { authenticateDevice } from '../middleware/deviceAuth.js';

const router = express.Router();

// Public kiosk dynamic QR endpoint (for physical wall terminals and live displays)
router.get('/qr-token/:deviceId', getKioskQrToken);
router.get('/qr/:deviceId', getKioskQrToken);

// 5.1 QR issue endpoint (Device authenticated with Bearer secret)
router.get('/qr', authenticateDevice, getQrToken);

// Kiosk metadata endpoint (Public read for kiosk headers)
router.get('/info/:deviceId', getDisplayInfo);

export default router;
