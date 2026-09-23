import prisma from '../prisma.js';
import { z } from 'zod';

// Zod schema
const createGateSchema = z.object({
  name: z.string().min(1).max(80),
});

// 4.3 List gates for a hostel
export async function listGates(req, res) {
  try {
    const { id: hostel_id } = req.params;

    // Verify hostel exists
    const hostel = await prisma.hostel.findUnique({ where: { id: hostel_id } });
    if (!hostel) {
      return res.status(404).json({ error: 'Hostel not found' });
    }

    const gates = await prisma.gate.findMany({
      where: { hostel_id },
      include: {
        devices: {
          select: {
            id: true,
            device_name: true,
            device_code: true,
            is_active: true,
            last_heartbeat_at: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return res.json({ gates });
  } catch (error) {
    console.error('List gates error:', error);
    return res.status(500).json({ error: 'Internal server error fetching gates' });
  }
}

// 4.3 Create gate for a hostel
export async function createGate(req, res) {
  try {
    const { id: hostel_id } = req.params;

    // Verify hostel exists
    const hostel = await prisma.hostel.findUnique({ where: { id: hostel_id } });
    if (!hostel) {
      return res.status(404).json({ error: 'Hostel not found' });
    }

    const parsed = createGateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
    }

    const gate = await prisma.gate.create({
      data: {
        name: parsed.data.name,
        hostel_id,
      },
      include: {
        devices: {
          select: {
            id: true,
            device_name: true,
            device_code: true,
            is_active: true,
          },
        },
      },
    });

    return res.status(201).json({ gate });
  } catch (error) {
    console.error('Create gate error:', error);
    return res.status(500).json({ error: 'Internal server error creating gate' });
  }
}
