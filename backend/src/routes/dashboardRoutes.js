import express from 'express';
import {
  getSuperAdminDashboard,
  getWardenDashboard,
  getMessAdminDashboard,
  getAttendanceHistory,
} from '../controllers/dashboardController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Require authentication for all dashboard routes
router.use(authenticate);

// 8.6 Super Admin KPIs & Global Feed
router.get('/admin', authorize('SUPER_ADMIN'), getSuperAdminDashboard);

// 8.2 & 8.3 Warden/Vice Warden/Caretaker Live Feed & Occupancy Panels
router.get('/warden', authorize('SUPER_ADMIN', 'WARDEN', 'VICE_WARDEN', 'CARETAKER'), getWardenDashboard);

// 8.4 & 8.5 Mess Admin Live Feed & Daily Meal Counts
router.get('/mess-admin', authorize('SUPER_ADMIN', 'MESS_ADMIN'), getMessAdminDashboard);

// 8.7 Searchable & Paginated Attendance History
router.get('/history', authorize('SUPER_ADMIN', 'WARDEN', 'VICE_WARDEN', 'CARETAKER', 'MESS_ADMIN'), getAttendanceHistory);

export default router;
