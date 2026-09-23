import prisma from '../prisma.js';
import { z } from 'zod';

// Time format HH:MM:SS or HH:MM
const timeRegex = /^\d{2}:\d{2}(:\d{2})?$/;

// Zod schemas
const createMealWindowSchema = z.object({
  meal_type: z.enum(['BREAKFAST', 'LUNCH', 'SNACKS', 'DINNER']),
  start_time: z.string().regex(timeRegex, 'Must be HH:MM or HH:MM:SS format'),
  end_time: z.string().regex(timeRegex, 'Must be HH:MM or HH:MM:SS format'),
  is_active: z.boolean().optional().default(true),
});

const updateMealWindowSchema = z.object({
  meal_type: z.enum(['BREAKFAST', 'LUNCH', 'SNACKS', 'DINNER']).optional(),
  start_time: z.string().regex(timeRegex, 'Must be HH:MM or HH:MM:SS format').optional(),
  end_time: z.string().regex(timeRegex, 'Must be HH:MM or HH:MM:SS format').optional(),
  is_active: z.boolean().optional(),
});

// 4.5 List meal windows for a mess
export async function listMealWindows(req, res) {
  try {
    const { id: mess_id } = req.params;

    // Verify mess exists
    const mess = await prisma.mess.findUnique({ where: { id: mess_id } });
    if (!mess) {
      return res.status(404).json({ error: 'Mess not found' });
    }

    const mealWindows = await prisma.mealWindow.findMany({
      where: { mess_id },
      orderBy: { start_time: 'asc' },
    });

    return res.json({ mealWindows });
  } catch (error) {
    console.error('List meal windows error:', error);
    return res.status(500).json({ error: 'Internal server error fetching meal windows' });
  }
}

// 4.5 Create meal window
export async function createMealWindow(req, res) {
  try {
    const { id: mess_id } = req.params;

    // Verify mess exists
    const mess = await prisma.mess.findUnique({ where: { id: mess_id } });
    if (!mess) {
      return res.status(404).json({ error: 'Mess not found' });
    }

    const parsed = createMealWindowSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
    }

    // Normalize time to HH:MM:SS
    const start_time = parsed.data.start_time.length === 5 ? `${parsed.data.start_time}:00` : parsed.data.start_time;
    const end_time = parsed.data.end_time.length === 5 ? `${parsed.data.end_time}:00` : parsed.data.end_time;

    const mealWindow = await prisma.mealWindow.create({
      data: {
        mess_id,
        meal_type: parsed.data.meal_type,
        start_time,
        end_time,
        is_active: parsed.data.is_active,
      },
    });

    return res.status(201).json({ mealWindow });
  } catch (error) {
    console.error('Create meal window error:', error);
    return res.status(500).json({ error: 'Internal server error creating meal window' });
  }
}

// 4.5 Update meal window
export async function updateMealWindow(req, res) {
  try {
    const { id: mess_id, wid } = req.params;

    // Verify meal window exists and belongs to this mess
    const existing = await prisma.mealWindow.findUnique({ where: { id: wid } });
    if (!existing || existing.mess_id !== mess_id) {
      return res.status(404).json({ error: 'Meal window not found in this mess' });
    }

    const parsed = updateMealWindowSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
    }

    // Normalize times if provided
    const data = { ...parsed.data };
    if (data.start_time && data.start_time.length === 5) {
      data.start_time = `${data.start_time}:00`;
    }
    if (data.end_time && data.end_time.length === 5) {
      data.end_time = `${data.end_time}:00`;
    }

    const mealWindow = await prisma.mealWindow.update({
      where: { id: wid },
      data,
    });

    return res.json({ mealWindow });
  } catch (error) {
    console.error('Update meal window error:', error);
    return res.status(500).json({ error: 'Internal server error updating meal window' });
  }
}
