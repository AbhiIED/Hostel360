import express from 'express';
import { scanAttendance, getSelfHistory } from '../controllers/attendanceController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { scanRateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// 6.1 QR scan endpoint (STUDENT role, rate-limited to 5 req/min)
router.post('/scan', authenticate, authorize('STUDENT'), scanRateLimiter, scanAttendance);

// 6.8 Student self history & profile endpoint
router.get('/self', authenticate, authorize('STUDENT'), getSelfHistory);

export default router;
