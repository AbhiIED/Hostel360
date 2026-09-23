import bcrypt from 'bcrypt';
import prisma from '../prisma.js';
import { z } from 'zod';

// Zod schemas
const createStudentSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(255),
  password: z.string().min(6).max(128),
  roll_number: z.string().min(1).max(30),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional().default('MALE'),
  department: z.string().max(50).optional().nullable(),
  year: z.number().int().min(1).max(6).optional().nullable(),
  hostel_id: z.string().uuid(),
  room_id: z.string().uuid(),
  photo_url: z.string().url().max(512).optional().nullable(),
});

const updateStudentSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  email: z.string().email().max(255).optional(),
  roll_number: z.string().min(1).max(30).optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  department: z.string().max(50).optional().nullable(),
  year: z.number().int().min(1).max(6).optional().nullable(),
  hostel_id: z.string().uuid().optional(),
  room_id: z.string().uuid().optional(),
  photo_url: z.string().url().max(512).optional().nullable(),
  current_state: z.enum(['INSIDE', 'OUTSIDE']).optional(),
});

// 4.6 List students
export async function listStudents(req, res) {
  try {
    const { hostel_id, search, page = '1', limit = '20' } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where = {};

    // Wardens see only their hostel's students
    if (req.user.role === 'WARDEN') {
      const wardenHostels = await prisma.hostel.findMany({
        where: { warden_id: req.user.id },
        select: { id: true },
      });
      where.hostel_id = { in: wardenHostels.map(h => h.id) };
    } else if (hostel_id) {
      where.hostel_id = hostel_id;
    }

    // Search by name or roll number
    if (search) {
      where.OR = [
        { roll_number: { contains: search } },
        { user: { name: { contains: search } } },
      ];
    }

    const [students, total] = await Promise.all([
      prisma.student.findMany({
        where,
        include: {
          user: {
            select: { id: true, name: true, email: true, role: true, is_active: true },
          },
          hostel: {
            select: { id: true, name: true, code: true },
          },
          room: {
            select: { id: true, room_number: true, floor: true, block: true },
          },
        },
        orderBy: { roll_number: 'asc' },
        skip,
        take: limitNum,
      }),
      prisma.student.count({ where }),
    ]);

    return res.json({
      students,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('List students error:', error);
    return res.status(500).json({ error: 'Internal server error fetching students' });
  }
}

// 4.6 Create student (creates User + Student atomically)
export async function createStudent(req, res) {
  try {
    const parsed = createStudentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
    }

    const { name, email, password, roll_number, gender, department, year, hostel_id, room_id, photo_url } = parsed.data;

    // Validate hostel exists
    const hostel = await prisma.hostel.findUnique({ where: { id: hostel_id } });
    if (!hostel) {
      return res.status(400).json({ error: 'Invalid hostel_id: hostel not found' });
    }

    // Validate room exists and belongs to the hostel
    const room = await prisma.room.findUnique({ where: { id: room_id } });
    if (!room || room.hostel_id !== hostel_id) {
      return res.status(400).json({ error: 'Invalid room_id: room not found or does not belong to the specified hostel' });
    }

    // Check room capacity
    const currentOccupants = await prisma.student.count({ where: { room_id } });
    if (currentOccupants >= room.capacity) {
      return res.status(409).json({ error: `Room ${room.room_number} is at full capacity (${room.capacity})` });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // Create User + Student atomically
    const student = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email,
          password_hash,
          role: 'STUDENT',
        },
      });

      const newStudent = await tx.student.create({
        data: {
          user_id: user.id,
          roll_number,
          gender,
          department: department || null,
          year: year || null,
          hostel_id,
          room_id,
          photo_url: photo_url || null,
        },
        include: {
          user: {
            select: { id: true, name: true, email: true, role: true, is_active: true },
          },
          hostel: {
            select: { id: true, name: true, code: true },
          },
          room: {
            select: { id: true, room_number: true, floor: true, block: true },
          },
        },
      });

      return newStudent;
    });

    return res.status(201).json({ student });
  } catch (error) {
    if (error.code === 'P2002') {
      const target = error.meta?.target || '';
      if (target.includes('email')) {
        return res.status(409).json({ error: 'A user with this email already exists' });
      }
      if (target.includes('roll_number')) {
        return res.status(409).json({ error: 'A student with this roll number already exists' });
      }
      return res.status(409).json({ error: 'Duplicate entry detected' });
    }
    console.error('Create student error:', error);
    return res.status(500).json({ error: 'Internal server error creating student' });
  }
}

// 4.6 Get single student
export async function getStudent(req, res) {
  try {
    const { id } = req.params;

    const student = await prisma.student.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true, is_active: true },
        },
        hostel: {
          select: { id: true, name: true, code: true, type: true },
        },
        room: {
          select: { id: true, room_number: true, floor: true, block: true },
        },
        _count: {
          select: { hostel_attendance: true, mess_attendance: true },
        },
      },
    });

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Wardens can only view students in their hostel
    if (req.user.role === 'WARDEN') {
      const isWarden = await prisma.hostel.findFirst({
        where: { id: student.hostel_id, warden_id: req.user.id },
      });
      if (!isWarden) {
        return res.status(403).json({ error: 'Access denied: student is not in your hostel' });
      }
    }

    return res.json({ student });
  } catch (error) {
    console.error('Get student error:', error);
    return res.status(500).json({ error: 'Internal server error fetching student' });
  }
}

// 4.6 Update student
export async function updateStudent(req, res) {
  try {
    const { id } = req.params;
    const parsed = updateStudentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
    }

    const existing = await prisma.student.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const { name, email, hostel_id, room_id, ...studentData } = parsed.data;

    // Validate hostel if changing
    if (hostel_id) {
      const hostel = await prisma.hostel.findUnique({ where: { id: hostel_id } });
      if (!hostel) {
        return res.status(400).json({ error: 'Invalid hostel_id: hostel not found' });
      }
    }

    // Validate room if changing
    if (room_id) {
      const targetHostelId = hostel_id || existing.hostel_id;
      const room = await prisma.room.findUnique({ where: { id: room_id } });
      if (!room || room.hostel_id !== targetHostelId) {
        return res.status(400).json({ error: 'Invalid room_id: room not found or does not belong to the hostel' });
      }

      // Check capacity (excluding current student)
      const currentOccupants = await prisma.student.count({
        where: { room_id, id: { not: id } },
      });
      if (currentOccupants >= room.capacity) {
        return res.status(409).json({ error: `Room ${room.room_number} is at full capacity (${room.capacity})` });
      }
    }

    // Update User + Student atomically
    const student = await prisma.$transaction(async (tx) => {
      // Update user fields if provided
      if (name || email) {
        await tx.user.update({
          where: { id: existing.user_id },
          data: {
            ...(name && { name }),
            ...(email && { email }),
          },
        });
      }

      // Update student fields
      const updatedStudent = await tx.student.update({
        where: { id },
        data: {
          ...studentData,
          ...(hostel_id && { hostel_id }),
          ...(room_id && { room_id }),
        },
        include: {
          user: {
            select: { id: true, name: true, email: true, role: true, is_active: true },
          },
          hostel: {
            select: { id: true, name: true, code: true },
          },
          room: {
            select: { id: true, room_number: true, floor: true, block: true },
          },
        },
      });

      return updatedStudent;
    });

    return res.json({ student });
  } catch (error) {
    if (error.code === 'P2002') {
      const target = error.meta?.target || '';
      if (target.includes('email')) {
        return res.status(409).json({ error: 'A user with this email already exists' });
      }
      if (target.includes('roll_number')) {
        return res.status(409).json({ error: 'A student with this roll number already exists' });
      }
      return res.status(409).json({ error: 'Duplicate entry detected' });
    }
    console.error('Update student error:', error);
    return res.status(500).json({ error: 'Internal server error updating student' });
  }
}

// 4.6 Delete student (cascades User deletion)
export async function deleteStudent(req, res) {
  try {
    const { id } = req.params;

    const existing = await prisma.student.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true } },
      },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Delete User (cascades to Student via onDelete: Cascade)
    await prisma.user.delete({ where: { id: existing.user_id } });

    return res.json({ message: `Student '${existing.user.name}' (${existing.roll_number}) deleted successfully` });
  } catch (error) {
    console.error('Delete student error:', error);
    return res.status(500).json({ error: 'Internal server error deleting student' });
  }
}
