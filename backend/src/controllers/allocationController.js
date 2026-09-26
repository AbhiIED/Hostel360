import prisma from '../prisma.js';
import { z } from 'zod';
import {
  createRenewalsForWindow,
  runBatchAllocation,
  confirmAllocation,
  bulkConfirmCleanAllocations,
  createRoomSwapRequest,
  acceptSwapPeer,
  decideRoomSwap,
} from '../services/allocationService.js';
import { userHasHostelAccess, getUserHostelIds } from '../utils/roleScoping.js';

// --- Zod Validation Schemas ---

const createWindowSchema = z.object({
  hostel_id: z.string().uuid().optional().nullable(),
  academic_year: z.string().min(4).max(20).optional(),
  academic_session: z.string().min(4).max(20).optional(),
  semester: z.number().int().min(1).max(2).optional().default(1),
  open_from: z.string().datetime(),
  open_to: z.string().datetime(),
});

const submitApplicationSchema = z.object({
  window_id: z.string().uuid(),
  hostel_id: z.string().uuid(),
  year_of_study: z.number().int().min(1).max(5),
  accessibility_needs: z.boolean().default(false),
  accessibility_details: z.string().max(500).optional().nullable(),
  accessibility_notes: z.string().max(500).optional().nullable(),
  document_urls: z.any().optional().nullable(),
  documents_url: z.string().max(512).optional().nullable(),
});

const runBatchSchema = z.object({
  window_id: z.string().uuid(),
  hostel_id: z.string().uuid(),
  lottery_seed: z.string().max(64).optional(),
});

const createSwapSchema = z.object({
  target_student_id: z.string().uuid().optional(),
  target_roll_number: z.string().min(1).max(30).optional(),
  note: z.string().max(500).optional().nullable(),
});

const decideSwapSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  decision_note: z.string().max(500).optional().nullable(),
});

// ==========================================
// 1. Registration Windows Management
// ==========================================

export async function listWindows(req, res) {
  try {
    const { hostel_id, status, academic_year, academic_session } = req.query;
    const where = {};

    if (hostel_id) where.hostel_id = hostel_id;
    if (status) where.status = status;
    const session = academic_year || academic_session;
    if (session) where.academic_year = session;

    const windows = await prisma.registrationWindow.findMany({
      where,
      include: {
        hostel: { select: { id: true, name: true, code: true, type: true } },
        _count: {
          select: { applications: true, batches: true },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return res.json({ windows });
  } catch (error) {
    console.error('listWindows error:', error);
    return res.status(500).json({ error: 'Failed to list registration windows' });
  }
}

export async function createWindow(req, res) {
  try {
    const parsed = createWindowSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
    }

    const { hostel_id, academic_year, academic_session, semester, open_from, open_to } = parsed.data;

    if (hostel_id) {
      const hostel = await prisma.hostel.findUnique({ where: { id: hostel_id } });
      if (!hostel) return res.status(404).json({ error: 'Hostel not found' });
    }

    const window = await prisma.registrationWindow.create({
      data: {
        hostel_id: hostel_id || null,
        academic_year: academic_year || academic_session || '2026-2027',
        semester: semester || 1,
        open_from: new Date(open_from),
        open_to: new Date(open_to),
        status: 'OPEN',
      },
      include: { hostel: true },
    });

    // Auto-create renewal applications for current residents of the target hostel
    let renewalsCreated = [];
    try {
      renewalsCreated = await createRenewalsForWindow(window.id, window.hostel_id);
    } catch (renewErr) {
      console.warn('Warning: Failed creating renewals for window:', renewErr.message);
    }

    return res.status(201).json({
      window,
      renewals_created: renewalsCreated.length,
      message: `Registration window opened successfully. Generated ${renewalsCreated.length} renewal applications for continuing residents.`,
    });
  } catch (error) {
    console.error('createWindow error:', error);
    return res.status(500).json({ error: 'Failed to create registration window' });
  }
}

export async function closeWindow(req, res) {
  try {
    const { id } = req.params;
    const { auto_run_batch, lottery_seed } = req.body;

    const window = await prisma.registrationWindow.findUnique({ where: { id } });
    if (!window) return res.status(404).json({ error: 'Registration window not found' });

    const updatedWindow = await prisma.registrationWindow.update({
      where: { id },
      data: { status: 'CLOSED' },
    });

    let batchResult = null;
    if (auto_run_batch && window.hostel_id) {
      batchResult = await runBatchAllocation({
        windowId: window.id,
        hostelId: window.hostel_id,
        lotterySeed: lottery_seed,
        executedBy: req.user.id,
      });
    }

    return res.json({
      window: updatedWindow,
      batch: batchResult ? batchResult.batch : null,
      message: 'Registration window closed successfully',
    });
  } catch (error) {
    console.error('closeWindow error:', error);
    return res.status(500).json({ error: error.message || 'Failed to close registration window' });
  }
}

// ==========================================
// 2. Floor-Year Mapping Configuration
// ==========================================

export async function getFloorYearMappings(req, res) {
  try {
    const { hostelId } = req.params;
    const mappings = await prisma.floorYearMapping.findMany({
      where: { hostel_id: hostelId },
      orderBy: { floor: 'asc' },
    });
    return res.json({ mappings });
  } catch (error) {
    console.error('getFloorYearMappings error:', error);
    return res.status(500).json({ error: 'Failed to retrieve floor-year mappings' });
  }
}

export async function updateFloorYearMappings(req, res) {
  try {
    const { hostelId } = req.params;
    const { mappings } = req.body; // Array of { floor: number, year_of_study: number }

    if (!Array.isArray(mappings)) {
      return res.status(400).json({ error: 'mappings must be an array of { floor, year_of_study }' });
    }

    // Verify hostel exists
    const hostel = await prisma.hostel.findUnique({ where: { id: hostelId } });
    if (!hostel) return res.status(404).json({ error: 'Hostel not found' });

    // Atomically replace all mappings for this hostel
    const result = await prisma.$transaction(async (tx) => {
      await tx.floorYearMapping.deleteMany({ where: { hostel_id: hostelId } });

      const created = [];
      for (const m of mappings) {
        const item = await tx.floorYearMapping.create({
          data: {
            hostel_id: hostelId,
            floor: parseInt(m.floor, 10),
            year_of_study: parseInt(m.year_of_study, 10),
          },
        });
        created.push(item);
      }
      return created;
    });

    return res.json({
      hostel_id: hostelId,
      mappings: result,
      message: 'Floor-year mappings updated successfully',
    });
  } catch (error) {
    console.error('updateFloorYearMappings error:', error);
    return res.status(500).json({ error: error.message || 'Failed to update floor-year mappings' });
  }
}

// ==========================================
// 3. Hostel Applications (Student Flow)
// ==========================================

export async function submitApplication(req, res) {
  try {
    const parsed = submitApplicationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
    }

    const {
      window_id,
      hostel_id,
      year_of_study,
      accessibility_needs,
      accessibility_details,
      accessibility_notes,
      document_urls,
      documents_url,
    } = parsed.data;

    // Resolve student record for the authenticated user
    const student = await prisma.student.findUnique({
      where: { user_id: req.user.id },
      include: { hostel: true },
    });
    if (!student) {
      return res.status(403).json({ error: 'Only registered students can apply for hostel accommodation' });
    }

    // Check if the window is open
    const window = await prisma.registrationWindow.findUnique({ where: { id: window_id } });
    if (!window) return res.status(404).json({ error: 'Registration window not found' });
    if (window.status !== 'OPEN') {
      return res.status(400).json({ error: 'Registration window is currently closed' });
    }

    const now = new Date();
    if (now < window.open_from || now > window.open_to) {
      return res.status(400).json({ error: 'Applications are only accepted within the open window dates' });
    }

    // Check target hostel
    const hostel = await prisma.hostel.findUnique({ where: { id: hostel_id } });
    if (!hostel) return res.status(404).json({ error: 'Target hostel not found' });

    // Validate gender alignment
    if (student.gender === 'MALE' && hostel.type === 'GIRLS') {
      return res.status(400).json({ error: 'Male students cannot apply to a female hostel' });
    }
    if (student.gender === 'FEMALE' && hostel.type === 'BOYS') {
      return res.status(400).json({ error: 'Female students cannot apply to a male hostel' });
    }

    // Prevent duplicate application in the same window
    const existing = await prisma.hostelApplication.findUnique({
      where: {
        window_id_student_id: {
          window_id,
          student_id: student.id,
        },
      },
    });
    if (existing) {
      return res.status(409).json({ error: 'You have already submitted an application for this registration window' });
    }

    const isRenewal = student.room_id !== null && student.hostel_id === hostel_id;

    const application = await prisma.hostelApplication.create({
      data: {
        window_id,
        student_id: student.id,
        hostel_id,
        year_of_study,
        is_renewal: isRenewal,
        accessibility_needs,
        accessibility_details: accessibility_needs ? (accessibility_details || accessibility_notes) : null,
        document_urls: document_urls || (documents_url ? [documents_url] : null),
        status: 'PENDING',
      },
      include: {
        hostel: { select: { id: true, name: true, code: true, type: true } },
        window: { select: { id: true, academic_year: true, status: true } },
      },
    });

    return res.status(201).json({
      application,
      message: 'Application submitted successfully. Room allocation will be processed after the registration window closes.',
    });
  } catch (error) {
    console.error('submitApplication error:', error);
    return res.status(500).json({ error: error.message || 'Failed to submit application' });
  }
}

export async function getMyApplication(req, res) {
  try {
    const student = await prisma.student.findUnique({
      where: { user_id: req.user.id },
    });
    if (!student) {
      return res.status(404).json({ error: 'Student record not found' });
    }

    const applications = await prisma.hostelApplication.findMany({
      where: { student_id: student.id },
      include: {
        hostel: true,
        redirect_from_hostel: true,
        window: true,
        room_allocation: {
          include: {
            room: true,
            hostel: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    // Also fetch any room swap requests for this student
    const swapRequests = await prisma.roomSwapRequest.findMany({
      where: {
        OR: [
          { sender_student_id: student.id },
          { target_student_id: student.id },
        ],
      },
      include: {
        sender_student: { include: { user: true, room: true } },
        target_student: { include: { user: true, room: true } },
        sender_room: true,
        target_room: true,
      },
      orderBy: { created_at: 'desc' },
    });

    return res.json({
      applications,
      swap_requests: swapRequests,
    });
  } catch (error) {
    console.error('getMyApplication error:', error);
    return res.status(500).json({ error: 'Failed to retrieve application status' });
  }
}

export async function listApplications(req, res) {
  try {
    const { window_id, hostel_id, status, is_renewal } = req.query;
    const where = {};

    if (window_id) where.window_id = window_id;
    if (status) where.status = status;
    if (is_renewal !== undefined) where.is_renewal = is_renewal === 'true';

    // Role-based hostel scoping
    const allowedHostelIds = getUserHostelIds(req.user);
    if (allowedHostelIds !== null) {
      if (allowedHostelIds.length === 0) return res.json({ applications: [], total: 0 });
      if (hostel_id) {
        if (!allowedHostelIds.includes(hostel_id)) {
          return res.status(403).json({ error: 'Access denied: not assigned to this hostel' });
        }
        where.hostel_id = hostel_id;
      } else {
        where.hostel_id = { in: allowedHostelIds };
      }
    } else if (hostel_id) {
      where.hostel_id = hostel_id;
    }

    const applications = await prisma.hostelApplication.findMany({
      where,
      include: {
        student: {
          include: {
            user: { select: { id: true, name: true, email: true } },
            room: true,
          },
        },
        hostel: true,
        redirect_from_hostel: true,
        room_allocation: {
          include: { room: true },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return res.json({ applications, total: applications.length });
  } catch (error) {
    console.error('listApplications error:', error);
    return res.status(500).json({ error: 'Failed to list applications' });
  }
}

// ==========================================
// 4. Batch Allocation Engine & Review
// ==========================================

export async function runBatch(req, res) {
  try {
    const parsed = runBatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
    }

    const { window_id, hostel_id, lottery_seed } = parsed.data;

    // Check staff access to target hostel
    if (!userHasHostelAccess(req.user, hostel_id)) {
      return res.status(403).json({ error: 'Access denied: not authorized for this hostel' });
    }

    const result = await runBatchAllocation({
      windowId: window_id,
      hostelId: hostel_id,
      lotterySeed: lottery_seed,
      executedBy: req.user.id,
    });

    return res.status(201).json({
      batch: result.batch,
      allocations_count: result.allocations.length,
      message: `Batch allocation executed successfully with seed ${result.batch.lottery_seed}. Placed ${result.batch.allocated_count} students.`,
    });
  } catch (error) {
    console.error('runBatch error:', error);
    return res.status(500).json({ error: error.message || 'Failed to execute batch room allocation' });
  }
}

export async function listBatches(req, res) {
  try {
    const { window_id, hostel_id } = req.query;
    const where = {};

    if (window_id) where.window_id = window_id;

    const allowedHostelIds = getUserHostelIds(req.user);
    if (allowedHostelIds !== null) {
      if (allowedHostelIds.length === 0) return res.json({ batches: [] });
      if (hostel_id) {
        if (!allowedHostelIds.includes(hostel_id)) {
          return res.status(403).json({ error: 'Access denied: not assigned to this hostel' });
        }
        where.hostel_id = hostel_id;
      } else {
        where.hostel_id = { in: allowedHostelIds };
      }
    } else if (hostel_id) {
      where.hostel_id = hostel_id;
    }

    const batches = await prisma.allocationBatch.findMany({
      where,
      include: {
        hostel: { select: { id: true, name: true, code: true } },
        window: { select: { id: true, academic_session: true, status: true } },
        executor: { select: { id: true, name: true, role: true } },
        _count: { select: { allocations: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    return res.json({ batches });
  } catch (error) {
    console.error('listBatches error:', error);
    return res.status(500).json({ error: 'Failed to list allocation batches' });
  }
}

export async function getBatchDetails(req, res) {
  try {
    const { id } = req.params;

    const batch = await prisma.allocationBatch.findUnique({
      where: { id },
      include: {
        hostel: true,
        window: true,
        executor: { select: { id: true, name: true, role: true } },
        allocations: {
          include: {
            student: {
              include: {
                user: { select: { id: true, name: true, email: true } },
              },
            },
            room: true,
            hostel: true,
            application: true,
            confirmer: { select: { id: true, name: true, role: true } },
          },
          orderBy: [{ is_clean: 'asc' }, { created_at: 'asc' }],
        },
      },
    });

    if (!batch) return res.status(404).json({ error: 'Batch not found' });

    if (!userHasHostelAccess(req.user, batch.hostel_id)) {
      return res.status(403).json({ error: 'Access denied: not authorized for this hostel' });
    }

    const summary = {
      total: batch.allocations.length,
      proposed: batch.allocations.filter((a) => a.status === 'PROPOSED').length,
      confirmed: batch.allocations.filter((a) => a.status === 'CONFIRMED').length,
      flagged: batch.allocations.filter((a) => !a.is_clean || a.status === 'FLAGGED').length,
      clean: batch.allocations.filter((a) => a.is_clean && a.status === 'PROPOSED').length,
      redirected: batch.allocations.filter((a) => a.cascade_step === 'REDIRECTED_HOSTEL').length,
      overflowed: batch.allocations.filter((a) => ['ADJACENT_FLOOR', 'ANY_FLOOR'].includes(a.cascade_step)).length,
    };

    return res.json({ batch, summary });
  } catch (error) {
    console.error('getBatchDetails error:', error);
    return res.status(500).json({ error: 'Failed to fetch batch details' });
  }
}

export async function bulkConfirmClean(req, res) {
  try {
    const { id: batchId } = req.params;

    const batch = await prisma.allocationBatch.findUnique({ where: { id: batchId } });
    if (!batch) return res.status(404).json({ error: 'Batch not found' });

    if (!userHasHostelAccess(req.user, batch.hostel_id)) {
      return res.status(403).json({ error: 'Access denied: not authorized for this hostel' });
    }

    const result = await bulkConfirmCleanAllocations(batchId, req.user.id);

    return res.json({
      batch_id: batchId,
      confirmed_count: result.confirmedCount,
      message: `Successfully confirmed ${result.confirmedCount} clean allocations. Room numbers assigned to students.`,
    });
  } catch (error) {
    console.error('bulkConfirmClean error:', error);
    return res.status(500).json({ error: error.message || 'Failed to bulk-confirm clean allocations' });
  }
}

export async function confirmAllocationSingle(req, res) {
  try {
    const { id } = req.params;
    const { review_notes } = req.body;

    const allocation = await prisma.roomAllocation.findUnique({ where: { id } });
    if (!allocation) return res.status(404).json({ error: 'Allocation not found' });

    if (!userHasHostelAccess(req.user, allocation.hostel_id)) {
      return res.status(403).json({ error: 'Access denied: not authorized for this hostel' });
    }

    const updated = await confirmAllocation(id, req.user.id, review_notes);

    return res.json({
      allocation: updated,
      message: 'Allocation confirmed. Student assigned to room.',
    });
  } catch (error) {
    console.error('confirmAllocationSingle error:', error);
    return res.status(500).json({ error: error.message || 'Failed to confirm allocation' });
  }
}

export async function flagAllocation(req, res) {
  try {
    const { id } = req.params;
    const { flag_reasons, review_notes } = req.body;

    const allocation = await prisma.roomAllocation.findUnique({ where: { id } });
    if (!allocation) return res.status(404).json({ error: 'Allocation not found' });

    if (!userHasHostelAccess(req.user, allocation.hostel_id)) {
      return res.status(403).json({ error: 'Access denied: not authorized for this hostel' });
    }

    const reasons = Array.isArray(flag_reasons) ? flag_reasons : [flag_reasons || 'Flagged for Warden review'];

    const updated = await prisma.roomAllocation.update({
      where: { id },
      data: {
        status: 'FLAGGED',
        is_clean: false,
        flag_reasons: reasons,
        review_notes: review_notes || allocation.review_notes,
      },
    });

    return res.json({
      allocation: updated,
      message: 'Allocation flagged and escalated to Warden.',
    });
  } catch (error) {
    console.error('flagAllocation error:', error);
    return res.status(500).json({ error: 'Failed to flag allocation' });
  }
}

export async function manualPlaceEscalated(req, res) {
  try {
    const { id } = req.params; // Application ID
    const { hostel_id, room_id, notes } = req.body;

    if (!hostel_id || !room_id) {
      return res.status(400).json({ error: 'hostel_id and room_id are required for manual placement' });
    }

    const app = await prisma.hostelApplication.findUnique({
      where: { id },
      include: { student: true },
    });
    if (!app) return res.status(404).json({ error: 'Application not found' });

    const room = await prisma.room.findUnique({ where: { id: room_id } });
    if (!room || room.hostel_id !== hostel_id) {
      return res.status(400).json({ error: 'Room does not exist or does not belong to specified hostel' });
    }

    const occupants = await prisma.student.count({ where: { room_id } });
    if (occupants >= room.capacity) {
      return res.status(409).json({ error: `Room ${room.room_number} is already at full capacity (${room.capacity})` });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Find or create batch for allocation record
      let batch = await tx.allocationBatch.findFirst({
        where: { window_id: app.window_id },
        orderBy: { created_at: 'desc' },
      });
      if (!batch) {
        batch = await tx.allocationBatch.create({
          data: {
            window_id: app.window_id,
            hostel_id,
            lottery_seed: 'ADMIN_MANUAL_PLACEMENT',
            status: 'COMPLETED',
            executed_by: req.user.id,
          },
        });
      }

      // 1. Update application
      await tx.hostelApplication.update({
        where: { id: app.id },
        data: {
          status: 'ALLOCATED',
          hostel_id,
          flag_reason: null,
        },
      });

      // 2. Create confirmed RoomAllocation
      const alloc = await tx.roomAllocation.create({
        data: {
          batch_id: batch.id,
          application_id: app.id,
          student_id: app.student_id,
          room_id: room.id,
          hostel_id,
          assigned_floor: room.floor,
          cascade_step: 'ANY_FLOOR',
          status: 'CONFIRMED',
          is_clean: true,
          confirmed_by: req.user.id,
          confirmed_at: new Date(),
          review_notes: notes || 'Super Admin manual placement for zero-vacancy escalated applicant',
        },
      });

      // 3. Atomically update student record
      await tx.student.update({
        where: { id: app.student_id },
        data: {
          hostel_id,
          room_id: room.id,
        },
      });

      return alloc;
    });

    return res.json({
      allocation: result,
      message: 'Student manually placed and confirmed in room by Super Admin',
    });
  } catch (error) {
    console.error('manualPlaceEscalated error:', error);
    return res.status(500).json({ error: error.message || 'Failed to place escalated applicant' });
  }
}

// ==========================================
// 5. Room Swap Requests (Post-Allocation)
// ==========================================

export async function createSwap(req, res) {
  try {
    const parsed = createSwapSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
    }

    const { target_student_id, target_roll_number, note } = parsed.data;

    const senderStudent = await prisma.student.findUnique({
      where: { user_id: req.user.id },
      include: { room: true },
    });
    if (!senderStudent || !senderStudent.room_id) {
      return res.status(400).json({ error: 'You must have an active confirmed room to request a room swap' });
    }

    let resolvedTargetId = target_student_id;
    if (!resolvedTargetId && target_roll_number) {
      const target = await prisma.student.findUnique({
        where: { roll_number: target_roll_number },
      });
      if (!target) {
        return res.status(404).json({ error: `Student with roll number ${target_roll_number} not found` });
      }
      resolvedTargetId = target.id;
    }

    if (!resolvedTargetId) {
      return res.status(400).json({ error: 'Target student ID or roll number is required' });
    }

    if (resolvedTargetId === senderStudent.id) {
      return res.status(400).json({ error: 'Cannot request a room swap with yourself' });
    }

    const swap = await createRoomSwapRequest({
      senderStudentId: senderStudent.id,
      targetStudentId: resolvedTargetId,
      note,
    });

    return res.status(201).json({
      swap,
      message: 'Room swap request created. Awaiting peer student acceptance.',
    });
  } catch (error) {
    console.error('createSwap error:', error);
    return res.status(400).json({ error: error.message || 'Failed to create room swap request' });
  }
}

export async function listMySwaps(req, res) {
  try {
    const student = await prisma.student.findUnique({ where: { user_id: req.user.id } });
    if (!student) return res.status(404).json({ error: 'Student record not found' });

    const swaps = await prisma.roomSwapRequest.findMany({
      where: {
        OR: [
          { sender_student_id: student.id },
          { target_student_id: student.id },
        ],
      },
      include: {
        sender_student: { include: { user: true, room: true } },
        target_student: { include: { user: true, room: true } },
        sender_room: true,
        target_room: true,
      },
      orderBy: { created_at: 'desc' },
    });

    return res.json({ swaps });
  } catch (error) {
    console.error('listMySwaps error:', error);
    return res.status(500).json({ error: 'Failed to retrieve swap requests' });
  }
}

export async function acceptPeerSwap(req, res) {
  try {
    const { id } = req.params;

    const student = await prisma.student.findUnique({ where: { user_id: req.user.id } });
    if (!student) return res.status(404).json({ error: 'Student record not found' });

    const updated = await acceptSwapPeer(id, student.id);

    return res.json({
      swap: updated,
      message: updated.is_cross_tier
        ? 'Swap accepted! Because this swap crosses floor-year mapping policy, it has been escalated to Warden for review.'
        : 'Swap accepted! Forwarded to Caretaker for approval.',
    });
  } catch (error) {
    console.error('acceptPeerSwap error:', error);
    return res.status(400).json({ error: error.message || 'Failed to accept room swap' });
  }
}

export async function listSwaps(req, res) {
  try {
    const { hostel_id, status, is_cross_tier } = req.query;
    const where = {};

    if (status) where.status = status;
    if (is_cross_tier !== undefined) where.is_cross_tier = is_cross_tier === 'true';

    const allowedHostelIds = getUserHostelIds(req.user);
    if (allowedHostelIds !== null) {
      if (allowedHostelIds.length === 0) return res.json({ swaps: [] });
      if (hostel_id) {
        if (!allowedHostelIds.includes(hostel_id)) {
          return res.status(403).json({ error: 'Access denied: not assigned to this hostel' });
        }
        where.sender_student = { hostel_id };
      } else {
        where.sender_student = { hostel_id: { in: allowedHostelIds } };
      }
    } else if (hostel_id) {
      where.sender_student = { hostel_id };
    }

    const swaps = await prisma.roomSwapRequest.findMany({
      where,
      include: {
        sender_student: { include: { user: true, room: true, hostel: true } },
        target_student: { include: { user: true, room: true, hostel: true } },
        sender_room: true,
        target_room: true,
        decider: { select: { id: true, name: true, role: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    return res.json({ swaps });
  } catch (error) {
    console.error('listSwaps error:', error);
    return res.status(500).json({ error: 'Failed to list swap requests' });
  }
}

export async function decideSwap(req, res) {
  try {
    const { id } = req.params;
    const parsed = decideSwapSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
    }

    const { action, decision_note } = parsed.data;

    const swap = await prisma.roomSwapRequest.findUnique({
      where: { id },
      include: { sender_student: true },
    });
    if (!swap) return res.status(404).json({ error: 'Swap request not found' });

    if (!userHasHostelAccess(req.user, swap.sender_student.hostel_id)) {
      return res.status(403).json({ error: 'Access denied: not authorized for this hostel' });
    }

    const result = await decideRoomSwap({
      swapId: id,
      userId: req.user.id,
      userRole: req.user.role,
      action,
      decisionNote: decision_note,
    });

    return res.json({
      swap: result,
      message: action === 'APPROVE' ? 'Room swap approved and students room assignments updated.' : 'Room swap rejected.',
    });
  } catch (error) {
    console.error('decideSwap error:', error);
    const status = error.statusCode || 400;
    return res.status(status).json({ error: error.message || 'Failed to process swap decision' });
  }
}
