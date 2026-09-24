import prisma from '../prisma.js';
import { z } from 'zod';
import { getUserHostelIds, userHasHostelAccess } from '../utils/roleScoping.js';

// Zod schemas — warden_id removed (staff assignments are separate)
const createHostelSchema = z.object({
  code: z.string().min(1).max(10),
  name: z.string().min(1).max(120),
  type: z.enum(['BOYS', 'GIRLS']),
  location: z.string().min(1).max(255),
  total_capacity: z.number().int().positive(),
  has_blocks: z.boolean().optional().default(false),
});

const updateHostelSchema = z.object({
  code: z.string().min(1).max(10).optional(),
  name: z.string().min(1).max(120).optional(),
  type: z.enum(['BOYS', 'GIRLS']).optional(),
  location: z.string().min(1).max(255).optional(),
  total_capacity: z.number().int().positive().optional(),
  has_blocks: z.boolean().optional(),
});

// 4.1 List all hostels
export async function listHostels(req, res) {
  try {
    // Scope by staff hostel assignments for non-super-admins
    const hostelIds = getUserHostelIds(req.user);
    const where = {};
    if (hostelIds !== null) {
      where.id = { in: hostelIds };
    }

    const hostels = await prisma.hostel.findMany({
      where,
      include: {
        staff_hostel_assignments: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true } },
          },
        },
        _count: {
          select: { students: true, rooms: true, gates: true },
        },
      },
      orderBy: { code: 'asc' },
    });

    return res.json({ hostels });
  } catch (error) {
    console.error('List hostels error:', error);
    return res.status(500).json({ error: 'Internal server error fetching hostels' });
  }
}

// 4.1 Create hostel
export async function createHostel(req, res) {
  try {
    const parsed = createHostelSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
    }

    const hostel = await prisma.hostel.create({
      data: parsed.data,
      include: {
        staff_hostel_assignments: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true } },
          },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        actor_id: req.user.id,
        actor_type: 'USER',
        action: 'HOSTEL_CREATED',
        target_type: 'Hostel',
        target_id: hostel.id,
        meta: { code: hostel.code, name: hostel.name, type: hostel.type },
      },
    });

    return res.status(201).json({ hostel });
  } catch (error) {
    if (error.code === 'P2002') {
      const field = error.meta?.target?.includes('code') ? 'code' : 'name';
      return res.status(409).json({ error: `A hostel with this ${field} already exists` });
    }
    console.error('Create hostel error:', error);
    return res.status(500).json({ error: 'Internal server error creating hostel' });
  }
}

// 4.1 Get single hostel
export async function getHostel(req, res) {
  try {
    const { id } = req.params;

    const hostel = await prisma.hostel.findUnique({
      where: { id },
      include: {
        staff_hostel_assignments: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true } },
          },
        },
        rooms: {
          orderBy: { room_number: 'asc' },
          include: {
            _count: { select: { students: true } },
          },
        },
        gates: {
          include: {
            devices: {
              select: { id: true, device_name: true, device_code: true, is_active: true },
            },
          },
        },
        _count: {
          select: { students: true, rooms: true, gates: true },
        },
      },
    });

    if (!hostel) {
      return res.status(404).json({ error: 'Hostel not found' });
    }

    // Staff can only access their assigned hostels
    if (!userHasHostelAccess(req.user, hostel.id)) {
      return res.status(403).json({ error: 'Access denied: you are not assigned to this hostel' });
    }

    return res.json({ hostel });
  } catch (error) {
    console.error('Get hostel error:', error);
    return res.status(500).json({ error: 'Internal server error fetching hostel' });
  }
}

// 4.1 Update hostel
export async function updateHostel(req, res) {
  try {
    const { id } = req.params;
    const parsed = updateHostelSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
    }

    const existing = await prisma.hostel.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Hostel not found' });
    }

    const hostel = await prisma.hostel.update({
      where: { id },
      data: parsed.data,
      include: {
        staff_hostel_assignments: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true } },
          },
        },
        _count: {
          select: { students: true, rooms: true, gates: true },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        actor_id: req.user.id,
        actor_type: 'USER',
        action: 'HOSTEL_UPDATED',
        target_type: 'Hostel',
        target_id: hostel.id,
        meta: { code: hostel.code, updates: parsed.data },
      },
    });

    return res.json({ hostel });
  } catch (error) {
    if (error.code === 'P2002') {
      const field = error.meta?.target?.includes('code') ? 'code' : 'name';
      return res.status(409).json({ error: `A hostel with this ${field} already exists` });
    }
    console.error('Update hostel error:', error);
    return res.status(500).json({ error: 'Internal server error updating hostel' });
  }
}

// 4.1 Delete hostel
export async function deleteHostel(req, res) {
  try {
    const { id } = req.params;

    const existing = await prisma.hostel.findUnique({
      where: { id },
      include: { _count: { select: { students: true } } },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Hostel not found' });
    }

    if (existing._count.students > 0) {
      return res.status(409).json({
        error: `Cannot delete hostel: ${existing._count.students} student(s) still assigned. Reassign or remove them first.`,
      });
    }

    await prisma.$transaction([
      prisma.hostel.delete({ where: { id } }),
      prisma.auditLog.create({
        data: {
          actor_id: req.user.id,
          actor_type: 'USER',
          action: 'HOSTEL_DELETED',
          target_type: 'Hostel',
          target_id: id,
          meta: { code: existing.code, name: existing.name },
        },
      }),
    ]);

    return res.json({ message: `Hostel '${existing.name}' deleted successfully` });
  } catch (error) {
    console.error('Delete hostel error:', error);
    return res.status(500).json({ error: 'Internal server error deleting hostel' });
  }
}
