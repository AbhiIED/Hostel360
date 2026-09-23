import express from 'express';
import { getOccupancyHistory, getMealTrends, exportReport } from '../controllers/analyticsController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

// 10.1 Occupancy history endpoint (SUPER_ADMIN and WARDEN)
router.get('/occupancy-history', authorize('SUPER_ADMIN', 'WARDEN'), getOccupancyHistory);

// 10.2 Meal trends endpoint (SUPER_ADMIN and MESS_ADMIN)
router.get('/meal-trends', authorize('SUPER_ADMIN', 'MESS_ADMIN'), getMealTrends);

// 10.3 CSV Export endpoint (SUPER_ADMIN, WARDEN, and MESS_ADMIN)
router.get('/export', authorize('SUPER_ADMIN', 'WARDEN', 'MESS_ADMIN'), exportReport);

export default router;
