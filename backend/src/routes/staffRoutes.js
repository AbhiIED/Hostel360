import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  createStaffInvite,
  listStaffInvites,
  regenerateStaffInvite,
  createNomination,
  listNominations,
  approveNomination,
  rejectNomination,
  verifyStaffInvite,
  acceptStaffInvite,
  endHostelAssignment,
  endMessAssignment,
  listStaffAssignments,
} from '../controllers/staffController.js';

const router = Router();

// --- Public Endpoints (Invite Verification & Account Setup) ---
router.get('/invites/verify', verifyStaffInvite);
router.post('/invites/accept', acceptStaffInvite);

// --- Authenticated Endpoints ---

// Staff Invites (Super Admin only)
router.post('/invites', authenticate, authorize('SUPER_ADMIN'), createStaffInvite);
router.get('/invites', authenticate, authorize('SUPER_ADMIN'), listStaffInvites);
router.post('/invites/:id/regenerate', authenticate, authorize('SUPER_ADMIN'), regenerateStaffInvite);

// Staff Nominations (Warden creates/views; Super Admin views/approves/rejects)
router.post('/nominations', authenticate, authorize('WARDEN', 'SUPER_ADMIN'), createNomination);
router.get('/nominations', authenticate, authorize('WARDEN', 'SUPER_ADMIN'), listNominations);
router.post('/nominations/:id/approve', authenticate, authorize('SUPER_ADMIN'), approveNomination);
router.post('/nominations/:id/reject', authenticate, authorize('SUPER_ADMIN'), rejectNomination);

// Staff Offboarding (End assignments & revoke sessions)
router.post('/assignments/hostel/:id/end', authenticate, authorize('WARDEN', 'SUPER_ADMIN'), endHostelAssignment);
router.post('/assignments/mess/:id/end', authenticate, authorize('SUPER_ADMIN'), endMessAssignment);

// Staff Directory / Assignments List
router.get('/assignments', authenticate, authorize('WARDEN', 'SUPER_ADMIN'), listStaffAssignments);

export default router;
