import express from 'express';
import { getOccupancyHistory, getMealTrends, exportReport } from '../controllers/analyticsController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

// 10.1 Occupancy history endpoint (all hostel staff + super admin)
router.get('/occupancy-history', authorize('SUPER_ADMIN', 'WARDEN', 'VICE_WARDEN', 'CARETAKER'), getOccupancyHistory);

// 10.2 Meal trends endpoint (SUPER_ADMIN and MESS_ADMIN)
router.get('/meal-trends', authorize('SUPER_ADMIN', 'MESS_ADMIN'), getMealTrends);

// 10.3 CSV Export endpoint (all staff roles)
router.get('/export', authorize('SUPER_ADMIN', 'WARDEN', 'VICE_WARDEN', 'CARETAKER', 'MESS_ADMIN'), exportReport);

export default router;
