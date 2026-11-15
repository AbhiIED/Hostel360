import express from 'express';
import rateLimit from 'express-rate-limit';
import {
  login,
  refresh,
  logout,
  getMe,
  getRegistrationOptions,
  registerStudentWithLottery,
  listHostelWardens,
} from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Rate limiter for login: 10 requests per minute per IP
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts from this IP, please try again after a minute' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for registration: 15 registrations per 15 minutes per IP
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { error: 'Too many registration requests from this IP, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Public endpoints
router.post('/login', loginLimiter, login);
router.post('/refresh', refresh);
router.get('/wardens', listHostelWardens);
router.get('/registration-options', getRegistrationOptions);
router.post('/register', registerLimiter, registerStudentWithLottery);

// Authenticated endpoints
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, getMe);

export default router;
