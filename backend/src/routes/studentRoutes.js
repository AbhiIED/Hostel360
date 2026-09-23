import express from 'express';
import { listStudents, createStudent, getStudent, updateStudent, deleteStudent } from '../controllers/studentController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Student CRUD — SUPER_ADMIN full CRUD, WARDEN read-only (scoped to hostel)
router.get('/', authorize('SUPER_ADMIN', 'WARDEN'), listStudents);
router.post('/', authorize('SUPER_ADMIN'), createStudent);
router.get('/:id', authorize('SUPER_ADMIN', 'WARDEN'), getStudent);
router.patch('/:id', authorize('SUPER_ADMIN'), updateStudent);
router.delete('/:id', authorize('SUPER_ADMIN'), deleteStudent);

export default router;
