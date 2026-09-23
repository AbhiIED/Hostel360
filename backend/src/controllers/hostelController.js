import prisma from '../prisma.js';
import { z } from 'zod';

// Zod schemas
const createHostelSchema = z.object({
  code: z.string().min(1).max(10),
  name: z.string().min(1).max(120),
  type: z.enum(['BOYS', 'GIRLS']),
  location: z.string().min(1).max(255),
  total_capacity: z.number().int().positive(),
  has_blocks: z.boolean().optional().default(false),
  warden_id: z.string().uuid().optional().nullable(),
});

const updateHostelSchema = z.object({
  code: z.string().min(1).max(10).optional(),
  name: z.string().min(1).max(120).optional(),
  type: z.enum(['BOYS', 'GIRLS']).optional(),
  location: z.string().min(1).max(255).optional(),
  total_capacity: z.number().int().positive().optional(),
  has_blocks: z.boolean().optional(),
  warden_id: z.string().uuid().optional().nullable(),
});

// 4.1 List all hostels
export async function listHostels(req, res) {
  try {
    // Wardens see only their assigned hostels
    const where = {};
    if (req.user.role === 'WARDEN') {
      where.warden_id = req.user.id;
    }

    const hostels = await prisma.hostel.findMany({
      where,
      include: {
        warden: {
          select: { id: true, name: true, email: true },
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

    // Validate warden_id if provided
    if (parsed.data.warden_id) {
      const warden = await prisma.user.findUnique({ where: { id: parsed.data.warden_id } });
      if (!warden || warden.role !== 'WARDEN') {
        return res.status(400).json({ error: 'Invalid warden_id: user not found or not a WARDEN' });
      }
    }

    const hostel = await prisma.hostel.create({
      data: parsed.data,
      include: {
        warden: {
          select: { id: true, name: true, email: true },
        },
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
        warden: {
          select: { id: true, name: true, email: true },
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

    // Wardens can only access their own hostels
    if (req.user.role === 'WARDEN' && hostel.warden_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied: you are not the warden of this hostel' });
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

    // Validate warden_id if provided
    if (parsed.data.warden_id) {
      const warden = await prisma.user.findUnique({ where: { id: parsed.data.warden_id } });
      if (!warden || warden.role !== 'WARDEN') {
        return res.status(400).json({ error: 'Invalid warden_id: user not found or not a WARDEN' });
      }
    }

    const hostel = await prisma.hostel.update({
      where: { id },
      data: parsed.data,
      include: {
        warden: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: { students: true, rooms: true, gates: true },
        },
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

    await prisma.hostel.delete({ where: { id } });

    return res.json({ message: `Hostel '${existing.name}' deleted successfully` });
  } catch (error) {
    console.error('Delete hostel error:', error);
    return res.status(500).json({ error: 'Internal server error deleting hostel' });
  }
}
