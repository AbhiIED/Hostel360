import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  listCurfewWindows,
  createCurfewWindow,
  updateCurfewWindow,
  deleteCurfewWindow,
  triggerManualSweep,
  createLeaveRequest,
  getSelfLeaveRequests,
  listLeaveRequests,
  updateLeaveRequestStatus,
  cancelLeaveRequest,
  listCurfewAlerts,
  resolveCurfewAlert,
  ingestPresenceSignal,
  getStudentPresenceHint,
} from '../controllers/curfewController.js';

const router = express.Router();

// --- Curfew Windows Configuration ---
router.get('/windows', authenticate, listCurfewWindows);
router.post('/windows', authenticate, authorize('SUPER_ADMIN'), createCurfewWindow);
router.patch('/windows/:id', authenticate, authorize('SUPER_ADMIN'), updateCurfewWindow);
router.delete('/windows/:id', authenticate, authorize('SUPER_ADMIN'), deleteCurfewWindow);
router.post('/sweep', authenticate, authorize('SUPER_ADMIN', 'WARDEN', 'VICE_WARDEN'), triggerManualSweep);

// --- Leave Requests (Out-Pass) Workflow ---
router.post('/leave-requests', authenticate, authorize('STUDENT'), createLeaveRequest);
router.get('/leave-requests/self', authenticate, authorize('STUDENT'), getSelfLeaveRequests);
router.get('/leave-requests', authenticate, authorize('WARDEN', 'VICE_WARDEN', 'CARETAKER', 'SUPER_ADMIN'), listLeaveRequests);
router.patch('/leave-requests/:id/status', authenticate, authorize('WARDEN', 'VICE_WARDEN', 'SUPER_ADMIN'), updateLeaveRequestStatus);
router.patch('/leave-requests/:id/cancel', authenticate, authorize('STUDENT'), cancelLeaveRequest);

// --- Curfew Alerts & Resolution ---
router.get('/alerts', authenticate, authorize('WARDEN', 'VICE_WARDEN', 'CARETAKER', 'SUPER_ADMIN'), listCurfewAlerts);
router.patch('/alerts/:id/resolve', authenticate, authorize('WARDEN', 'VICE_WARDEN', 'CARETAKER', 'SUPER_ADMIN'), resolveCurfewAlert);

// --- Device Presence Signals (Advisory Only) ---
router.post('/presence-signals', ingestPresenceSignal);
router.get('/presence-hint/:studentId', authenticate, getStudentPresenceHint);

export default router;
