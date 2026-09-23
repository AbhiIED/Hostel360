import express from 'express';
import { listHostels, createHostel, getHostel, updateHostel, deleteHostel } from '../controllers/hostelController.js';
import { listRooms, createRoom } from '../controllers/roomController.js';
import { listGates, createGate } from '../controllers/gateController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Hostel CRUD — SUPER_ADMIN write, WARDEN+SUPER_ADMIN read
router.get('/', authorize('SUPER_ADMIN', 'WARDEN'), listHostels);
router.post('/', authorize('SUPER_ADMIN'), createHostel);
router.get('/:id', authorize('SUPER_ADMIN', 'WARDEN'), getHostel);
router.patch('/:id', authorize('SUPER_ADMIN'), updateHostel);
router.delete('/:id', authorize('SUPER_ADMIN'), deleteHostel);

// Nested rooms — /api/hostels/:id/rooms
router.get('/:id/rooms', authorize('SUPER_ADMIN', 'WARDEN'), listRooms);
router.post('/:id/rooms', authorize('SUPER_ADMIN'), createRoom);

// Nested gates — /api/hostels/:id/gates
router.get('/:id/gates', authorize('SUPER_ADMIN', 'WARDEN'), listGates);
router.post('/:id/gates', authorize('SUPER_ADMIN'), createGate);

export default router;
