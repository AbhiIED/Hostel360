import express from 'express';
import { registerDevice, listDevices, heartbeat, disableDevice } from '../controllers/deviceController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { authenticateDevice } from '../middleware/deviceAuth.js';

const router = express.Router();

// Device authenticated endpoints
router.post('/heartbeat', authenticateDevice, heartbeat);

// SUPER_ADMIN authenticated endpoints
router.post('/register', authenticate, authorize('SUPER_ADMIN'), registerDevice);
router.get('/', authenticate, authorize('SUPER_ADMIN'), listDevices);
router.patch('/:id/disable', authenticate, authorize('SUPER_ADMIN'), disableDevice);

export default router;
