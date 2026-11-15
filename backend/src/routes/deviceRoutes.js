import express from 'express';
import {
  registerDevice,
  listDevices,
  heartbeat,
  disableDevice,
  listMyKiosks,
  forceRefreshToken,
  reportMalfunction,
  getDeviceQrToken,
} from '../controllers/deviceController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { authenticateDevice } from '../middleware/deviceAuth.js';

const router = express.Router();

// Device authenticated endpoints
router.post('/heartbeat', authenticateDevice, heartbeat);

// Staff & Admin QR token retrieval for dashboard kiosk inspection
router.get('/:id/qr-token', authenticate, authorize('SUPER_ADMIN', 'WARDEN', 'VICE_WARDEN', 'CARETAKER'), getDeviceQrToken);
router.post('/:id/qr-token', authenticate, authorize('SUPER_ADMIN', 'WARDEN', 'VICE_WARDEN', 'CARETAKER'), getDeviceQrToken);

// Caretaker / Staff operational endpoints
router.get('/my-kiosks', authenticate, authorize('CARETAKER', 'WARDEN', 'VICE_WARDEN', 'SUPER_ADMIN'), listMyKiosks);
router.post('/:id/force-refresh', authenticate, authorize('CARETAKER', 'WARDEN', 'VICE_WARDEN', 'SUPER_ADMIN'), forceRefreshToken);
router.post('/:id/report-malfunction', authenticate, authorize('CARETAKER', 'WARDEN', 'VICE_WARDEN', 'SUPER_ADMIN'), reportMalfunction);

// SUPER_ADMIN ONLY device-provisioning endpoints (Caretaker strictly forbidden)
router.post('/register', authenticate, authorize('SUPER_ADMIN'), registerDevice);
router.get('/', authenticate, authorize('SUPER_ADMIN'), listDevices);
router.patch('/:id/disable', authenticate, authorize('SUPER_ADMIN'), disableDevice);

export default router;
