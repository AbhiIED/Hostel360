import prisma from '../prisma.js';
import { z } from 'zod';

// Zod schemas
const createMessSchema = z.object({
  name: z.string().min(1).max(120),
  hostel_id: z.string().uuid().optional().nullable(),
  mess_admin_id: z.string().uuid().optional().nullable(),
});

const updateMessSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  hostel_id: z.string().uuid().optional().nullable(),
  mess_admin_id: z.string().uuid().optional().nullable(),
});

// 4.4 List all messes
export async function listMesses(req, res) {
  try {
    const messes = await prisma.mess.findMany({
      include: {
        hostel: {
          select: { id: true, name: true, code: true },
        },
        mess_admin: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: { meal_windows: true, devices: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return res.json({ messes });
  } catch (error) {
    console.error('List messes error:', error);
    return res.status(500).json({ error: 'Internal server error fetching messes' });
  }
}

// 4.4 Create mess
export async function createMess(req, res) {
  try {
    const parsed = createMessSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
    }

    // Validate hostel_id if provided
    if (parsed.data.hostel_id) {
      const hostel = await prisma.hostel.findUnique({ where: { id: parsed.data.hostel_id } });
      if (!hostel) {
        return res.status(400).json({ error: 'Invalid hostel_id: hostel not found' });
      }
    }

    // Validate mess_admin_id if provided
    if (parsed.data.mess_admin_id) {
      const admin = await prisma.user.findUnique({ where: { id: parsed.data.mess_admin_id } });
      if (!admin || admin.role !== 'MESS_ADMIN') {
        return res.status(400).json({ error: 'Invalid mess_admin_id: user not found or not a MESS_ADMIN' });
      }
    }

    const mess = await prisma.mess.create({
      data: parsed.data,
      include: {
        hostel: {
          select: { id: true, name: true, code: true },
        },
        mess_admin: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: { meal_windows: true, devices: true },
        },
      },
    });

    return res.status(201).json({ mess });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'A mess with this name already exists' });
    }
    console.error('Create mess error:', error);
    return res.status(500).json({ error: 'Internal server error creating mess' });
  }
}

// 4.4 Get single mess
export async function getMess(req, res) {
  try {
    const { id } = req.params;

    const mess = await prisma.mess.findUnique({
      where: { id },
      include: {
        hostel: {
          select: { id: true, name: true, code: true },
        },
        mess_admin: {
          select: { id: true, name: true, email: true },
        },
        meal_windows: {
          orderBy: { start_time: 'asc' },
        },
        devices: {
          select: {
            id: true,
            device_name: true,
            device_code: true,
            is_active: true,
            last_heartbeat_at: true,
          },
        },
        _count: {
          select: { meal_windows: true, devices: true },
        },
      },
    });

    if (!mess) {
      return res.status(404).json({ error: 'Mess not found' });
    }

    return res.json({ mess });
  } catch (error) {
    console.error('Get mess error:', error);
    return res.status(500).json({ error: 'Internal server error fetching mess' });
  }
}

// 4.4 Update mess
export async function updateMess(req, res) {
  try {
    const { id } = req.params;
    const parsed = updateMessSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
    }

    const existing = await prisma.mess.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Mess not found' });
    }

    // Validate hostel_id if provided
    if (parsed.data.hostel_id) {
      const hostel = await prisma.hostel.findUnique({ where: { id: parsed.data.hostel_id } });
      if (!hostel) {
        return res.status(400).json({ error: 'Invalid hostel_id: hostel not found' });
      }
    }

    // Validate mess_admin_id if provided
    if (parsed.data.mess_admin_id) {
      const admin = await prisma.user.findUnique({ where: { id: parsed.data.mess_admin_id } });
      if (!admin || admin.role !== 'MESS_ADMIN') {
        return res.status(400).json({ error: 'Invalid mess_admin_id: user not found or not a MESS_ADMIN' });
      }
    }

    const mess = await prisma.mess.update({
      where: { id },
      data: parsed.data,
      include: {
        hostel: {
          select: { id: true, name: true, code: true },
        },
        mess_admin: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: { meal_windows: true, devices: true },
        },
      },
    });

    return res.json({ mess });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'A mess with this name already exists' });
    }
    console.error('Update mess error:', error);
    return res.status(500).json({ error: 'Internal server error updating mess' });
  }
}

// 4.4 Delete mess
export async function deleteMess(req, res) {
  try {
    const { id } = req.params;

    const existing = await prisma.mess.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Mess not found' });
    }

    await prisma.mess.delete({ where: { id } });

    return res.json({ message: `Mess '${existing.name}' deleted successfully` });
  } catch (error) {
    console.error('Delete mess error:', error);
    return res.status(500).json({ error: 'Internal server error deleting mess' });
  }
}

// 7.1 Resolve active and upcoming meal windows
export async function getActiveWindow(req, res) {
  try {
    const { id } = req.params;
    const { resolveMealWindow } = await import('../services/mealWindowService.js');
    const resolved = await resolveMealWindow(id);
    return res.json(resolved);
  } catch (error) {
    console.error('Get active window error:', error);
    return res.status(500).json({ error: 'Internal server error resolving meal window' });
  }
}
