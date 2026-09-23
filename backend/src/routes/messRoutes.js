import express from 'express';
import { listMesses, createMess, getMess, updateMess, deleteMess, getActiveWindow } from '../controllers/messController.js';
import { listMealWindows, createMealWindow, updateMealWindow } from '../controllers/mealWindowController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// 7.1 Active meal window resolver
router.get('/:id/active-window', getActiveWindow);

// Mess CRUD — SUPER_ADMIN only
router.get('/', authorize('SUPER_ADMIN', 'MESS_ADMIN'), listMesses);
router.post('/', authorize('SUPER_ADMIN'), createMess);
router.get('/:id', authorize('SUPER_ADMIN', 'MESS_ADMIN'), getMess);
router.patch('/:id', authorize('SUPER_ADMIN'), updateMess);
router.delete('/:id', authorize('SUPER_ADMIN'), deleteMess);

// Nested meal windows — /api/messes/:id/meal-windows
router.get('/:id/meal-windows', authorize('SUPER_ADMIN', 'MESS_ADMIN'), listMealWindows);
router.post('/:id/meal-windows', authorize('SUPER_ADMIN', 'MESS_ADMIN'), createMealWindow);
router.patch('/:id/meal-windows/:wid', authorize('SUPER_ADMIN', 'MESS_ADMIN'), updateMealWindow);

export default router;
