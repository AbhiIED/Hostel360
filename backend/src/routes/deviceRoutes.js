import express from 'express';
import { registerDevice, listDevices } from '../controllers/deviceController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Protected SUPER_ADMIN routes
router.post('/register', authenticate, authorize('SUPER_ADMIN'), registerDevice);
router.get('/', authenticate, authorize('SUPER_ADMIN'), listDevices);

export default router;
