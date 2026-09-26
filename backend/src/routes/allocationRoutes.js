import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  listWindows,
  createWindow,
  closeWindow,
  getFloorYearMappings,
  updateFloorYearMappings,
  submitApplication,
  getMyApplication,
  listApplications,
  manualPlaceEscalated,
  runBatch,
  listBatches,
  getBatchDetails,
  bulkConfirmClean,
  confirmAllocationSingle,
  flagAllocation,
  createSwap,
  listMySwaps,
  acceptPeerSwap,
  listSwaps,
  decideSwap,
} from '../controllers/allocationController.js';

const router = express.Router();

router.use(authenticate);

// --- 1. Registration Windows ---
router.get('/windows', listWindows);
router.post('/windows', authorize('SUPER_ADMIN'), createWindow);
router.patch('/windows/:id/close', authorize('SUPER_ADMIN'), closeWindow);

// --- 2. Floor-Year Mappings ---
router.get('/floor-year-mappings/:hostelId', getFloorYearMappings);
router.put('/floor-year-mappings/:hostelId', authorize('SUPER_ADMIN'), updateFloorYearMappings);

// --- 3. Hostel Applications ---
router.post('/applications', authorize('STUDENT'), submitApplication);
router.get('/applications/my', authorize('STUDENT'), getMyApplication);
router.get('/applications', authorize('CARETAKER', 'WARDEN', 'VICE_WARDEN', 'SUPER_ADMIN'), listApplications);
router.patch('/applications/:id/manual-place', authorize('SUPER_ADMIN'), manualPlaceEscalated);

// --- 4. Batch Allocation Engine & Review ---
router.post('/batches/run', authorize('SUPER_ADMIN', 'WARDEN'), runBatch);
router.get('/batches', authorize('CARETAKER', 'WARDEN', 'VICE_WARDEN', 'SUPER_ADMIN'), listBatches);
router.get('/batches/:id', authorize('CARETAKER', 'WARDEN', 'VICE_WARDEN', 'SUPER_ADMIN'), getBatchDetails);
router.post('/batches/:id/confirm-clean', authorize('CARETAKER', 'WARDEN', 'VICE_WARDEN', 'SUPER_ADMIN'), bulkConfirmClean);
router.patch('/allocations/:id/confirm', authorize('CARETAKER', 'WARDEN', 'VICE_WARDEN', 'SUPER_ADMIN'), confirmAllocationSingle);
router.patch('/allocations/:id/flag', authorize('CARETAKER', 'WARDEN', 'VICE_WARDEN', 'SUPER_ADMIN'), flagAllocation);

// --- 5. Room Swap Requests ---
router.post('/swaps', authorize('STUDENT'), createSwap);
router.get('/swaps/my', authorize('STUDENT'), listMySwaps);
router.patch('/swaps/:id/peer-accept', authorize('STUDENT'), acceptPeerSwap);
router.get('/swaps', authorize('CARETAKER', 'WARDEN', 'VICE_WARDEN', 'SUPER_ADMIN'), listSwaps);
router.patch('/swaps/:id/decide', authorize('CARETAKER', 'WARDEN', 'VICE_WARDEN', 'SUPER_ADMIN'), decideSwap);

export default router;
