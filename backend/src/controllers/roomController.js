import prisma from '../prisma.js';
import { z } from 'zod';

// Zod schemas
const createRoomSchema = z.object({
  room_number: z.string().min(1).max(10),
  floor: z.number().int().min(0).default(0),
  block: z.string().max(2).optional().nullable(),
  capacity: z.number().int().positive().default(2),
  status: z.enum(['ACTIVE', 'MAINTENANCE', 'CLOSED']).optional().default('ACTIVE'),
});

// 4.2 List rooms for a hostel
export async function listRooms(req, res) {
  try {
    const { id: hostel_id } = req.params;

    // Verify hostel exists
    const hostel = await prisma.hostel.findUnique({ where: { id: hostel_id } });
    if (!hostel) {
      return res.status(404).json({ error: 'Hostel not found' });
    }

    // Wardens can only access their own hostels
    if (req.user.role === 'WARDEN' && hostel.warden_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied: you are not the warden of this hostel' });
    }

    // Build filter from query params
    const where = { hostel_id };
    if (req.query.block) where.block = req.query.block;
    if (req.query.floor !== undefined) where.floor = parseInt(req.query.floor, 10);
    if (req.query.status) where.status = req.query.status;

    const rooms = await prisma.room.findMany({
      where,
      include: {
        _count: { select: { students: true } },
      },
      orderBy: { room_number: 'asc' },
    });

    return res.json({ rooms });
  } catch (error) {
    console.error('List rooms error:', error);
    return res.status(500).json({ error: 'Internal server error fetching rooms' });
  }
}

// 4.2 Create room in a hostel
export async function createRoom(req, res) {
  try {
    const { id: hostel_id } = req.params;

    // Verify hostel exists
    const hostel = await prisma.hostel.findUnique({ where: { id: hostel_id } });
    if (!hostel) {
      return res.status(404).json({ error: 'Hostel not found' });
    }

    const parsed = createRoomSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
    }

    const room = await prisma.room.create({
      data: {
        ...parsed.data,
        hostel_id,
      },
      include: {
        _count: { select: { students: true } },
      },
    });

    return res.status(201).json({ room });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'A room with this room_number already exists in this hostel' });
    }
    console.error('Create room error:', error);
    return res.status(500).json({ error: 'Internal server error creating room' });
  }
}
