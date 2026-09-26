import { z } from 'zod';
import prisma from '../prisma.js';
import { getUserHostelIds, userHasHostelAccess } from '../utils/roleScoping.js';
import {
  isStudentInCurfew,
  triggerCurfewSweep,
  getActiveCurfewWindowsForHostel,
  calculateLeaveRiskTier,
} from '../services/curfewService.js';

// --- Zod Validation Schemas ---

const curfewWindowSchema = z.object({
  hostel_id: z.string().uuid().nullable().optional(),
  day_type: z.enum(['EVERYDAY', 'WEEKDAY', 'WEEKEND']).default('EVERYDAY'),
  start_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'Format must be HH:mm or HH:mm:ss'),
  end_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'Format must be HH:mm or HH:mm:ss'),
  grace_period_minutes: z.number().int().min(0).max(180).default(30),
  max_low_risk_hours: z.number().int().min(1).max(72).default(8),
  is_active: z.boolean().default(true),
});

const updateCurfewWindowSchema = curfewWindowSchema.partial();

const leaveRequestSchema = z.object({
  requested_from: z.string().datetime(),
  requested_to: z.string().datetime(),
  reason: z.string().min(3, 'Reason must be at least 3 characters').max(1000),
});

const resolveAlertSchema = z.object({
  status: z.enum(['ACKNOWLEDGED', 'RESOLVED']),
  resolution_note: z.string().min(3, 'Resolution note is required (at least 3 characters)'),
});

const presenceSignalSchema = z.object({
  student_id: z.string().uuid(),
  event_type: z.enum(['CONNECTED', 'DISCONNECTED']),
  hostel_id: z.string().uuid().optional(),
  timestamp: z.string().datetime().optional(),
});

// --- 1. Curfew Windows Handlers ---

export async function listCurfewWindows(req, res) {
  try {
    const windows = await prisma.curfewWindow.findMany({
      include: {
        hostel: { select: { id: true, name: true, code: true, type: true } },
        updater: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ hostel_id: 'asc' }, { start_time: 'asc' }],
    });

    return res.json({ windows });
  } catch (error) {
    console.error('listCurfewWindows error:', error);
    return res.status(500).json({ error: 'Failed to retrieve curfew windows' });
  }
}

export async function createCurfewWindow(req, res) {
  try {
    const parseResult = curfewWindowSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Validation failed', details: parseResult.error.flatten() });
    }

    const data = parseResult.data;

    // Normalize HH:mm
    const start_time = data.start_time.slice(0, 5);
    const end_time = data.end_time.slice(0, 5);

    const window = await prisma.curfewWindow.create({
      data: {
        hostel_id: data.hostel_id || null,
        day_type: data.day_type,
        start_time,
        end_time,
        grace_period_minutes: data.grace_period_minutes,
        max_low_risk_hours: data.max_low_risk_hours ?? 8,
        is_active: data.is_active,
        updated_by: req.user.id,
      },
      include: {
        hostel: { select: { id: true, name: true, code: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        actor_id: req.user.id,
        actor_type: 'USER',
        action: 'CURFEW_WINDOW_CREATED',
        target_type: 'CurfewWindow',
        target_id: window.id,
        meta: {
          hostel_id: window.hostel_id,
          start_time,
          end_time,
          day_type: window.day_type,
        },
      },
    });

    return res.status(201).json({ message: 'Curfew window created successfully', window });
  } catch (error) {
    console.error('createCurfewWindow error:', error);
    return res.status(500).json({ error: 'Failed to create curfew window' });
  }
}

export async function updateCurfewWindow(req, res) {
  try {
    const { id } = req.params;
    const parseResult = updateCurfewWindowSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Validation failed', details: parseResult.error.flatten() });
    }

    const data = parseResult.data;
    if (data.start_time) data.start_time = data.start_time.slice(0, 5);
    if (data.end_time) data.end_time = data.end_time.slice(0, 5);

    const updated = await prisma.curfewWindow.update({
      where: { id },
      data: {
        ...data,
        updated_by: req.user.id,
      },
      include: {
        hostel: { select: { id: true, name: true, code: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        actor_id: req.user.id,
        actor_type: 'USER',
        action: 'CURFEW_WINDOW_UPDATED',
        target_type: 'CurfewWindow',
        target_id: id,
        meta: data,
      },
    });

    return res.json({ message: 'Curfew window updated successfully', window: updated });
  } catch (error) {
    console.error('updateCurfewWindow error:', error);
    return res.status(500).json({ error: 'Failed to update curfew window' });
  }
}

export async function deleteCurfewWindow(req, res) {
  try {
    const { id } = req.params;
    await prisma.curfewWindow.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        actor_id: req.user.id,
        actor_type: 'USER',
        action: 'CURFEW_WINDOW_DELETED',
        target_type: 'CurfewWindow',
        target_id: id,
      },
    });

    return res.json({ message: 'Curfew window deleted successfully' });
  } catch (error) {
    console.error('deleteCurfewWindow error:', error);
    return res.status(500).json({ error: 'Failed to delete curfew window' });
  }
}

export async function triggerManualSweep(req, res) {
  try {
    const { hostel_id, skip_delay = false } = req.body;
    const io = req.app.get('io');

    const windows = await getActiveCurfewWindowsForHostel(hostel_id);
    if (windows.length === 0) {
      return res.status(404).json({ error: 'No active curfew windows found for this hostel or campus default' });
    }

    const window = windows[0];
    const result = await triggerCurfewSweep({
      hostelId: hostel_id,
      window,
      io,
      skipDelay: Boolean(skip_delay),
    });

    return res.json({
      message: 'Curfew sweep executed successfully',
      result,
    });
  } catch (error) {
    console.error('triggerManualSweep error:', error);
    return res.status(500).json({ error: 'Failed to trigger curfew sweep' });
  }
}

// --- 2. Leave Request (Out-Pass) Handlers ---

export async function createLeaveRequest(req, res) {
  try {
    const student = await prisma.student.findUnique({
      where: { user_id: req.user.id },
      include: { hostel: true },
    });

    if (!student) {
      return res.status(404).json({ error: 'Student record not found for this account' });
    }

    const parseResult = leaveRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Validation failed', details: parseResult.error.flatten() });
    }

    const { requested_from, requested_to, reason } = parseResult.data;
    const fromDate = new Date(requested_from);
    const toDate = new Date(requested_to);

    if (fromDate >= toDate) {
      return res.status(400).json({ error: 'requested_to must be after requested_from' });
    }

    const riskTier = await calculateLeaveRiskTier(student.hostel_id, fromDate, toDate);

    const leaveRequest = await prisma.leaveRequest.create({
      data: {
        student_id: student.id,
        hostel_id: student.hostel_id,
        requested_from: fromDate,
        requested_to: toDate,
        reason,
        status: 'PENDING',
        risk_tier: riskTier,
      },
      include: {
        student: {
          include: {
            user: { select: { id: true, name: true, email: true } },
            room: { select: { room_number: true, floor: true, block: true } },
          },
        },
        hostel: { select: { id: true, name: true, code: true } },
        decider: { select: { id: true, name: true, role: true } },
        caretaker_verifier: { select: { id: true, name: true, role: true } },
      },
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`hostel:${student.hostel_id}`).emit('curfew:leave_request:new', leaveRequest);
      io.to('admin:feed').emit('curfew:leave_request:new', leaveRequest);
    }

    return res.status(201).json({
      message: 'Leave request submitted successfully',
      leave_request: leaveRequest,
    });
  } catch (error) {
    console.error('createLeaveRequest error:', error);
    return res.status(500).json({ error: 'Failed to submit leave request' });
  }
}

export async function editLeaveRequest(req, res) {
  try {
    const { id } = req.params;
    const parseResult = leaveRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Validation failed', details: parseResult.error.flatten() });
    }

    const { requested_from, requested_to, reason } = parseResult.data;
    const fromDate = new Date(requested_from);
    const toDate = new Date(requested_to);

    if (fromDate >= toDate) {
      return res.status(400).json({ error: 'requested_to must be after requested_from' });
    }

    const existing = await prisma.leaveRequest.findUnique({
      where: { id },
      include: { student: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Leave request not found' });
    }

    // Only creator student can edit
    if (existing.student.user_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only edit your own leave requests' });
    }

    // Can only edit if still PENDING
    if (existing.status !== 'PENDING') {
      return res.status(400).json({ error: `Cannot edit leave request in ${existing.status} status` });
    }

    // Re-evaluate risk tier dynamically
    const newRiskTier = await calculateLeaveRiskTier(existing.hostel_id, fromDate, toDate);

    const updated = await prisma.leaveRequest.update({
      where: { id },
      data: {
        requested_from: fromDate,
        requested_to: toDate,
        reason,
        risk_tier: newRiskTier,
      },
      include: {
        student: {
          include: {
            user: { select: { id: true, name: true, email: true } },
            room: { select: { room_number: true, floor: true, block: true } },
          },
        },
        hostel: { select: { id: true, name: true, code: true } },
        decider: { select: { id: true, name: true, role: true } },
        caretaker_verifier: { select: { id: true, name: true, role: true } },
      },
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`hostel:${existing.hostel_id}`).emit('curfew:leave_request:updated', updated);
      io.to('admin:feed').emit('curfew:leave_request:updated', updated);
    }

    return res.json({
      message: 'Leave request updated successfully',
      leave_request: updated,
    });
  } catch (error) {
    console.error('editLeaveRequest error:', error);
    return res.status(500).json({ error: 'Failed to update leave request' });
  }
}

export async function verifyLeaveRequest(req, res) {
  try {
    const { id } = req.params;
    const { note } = req.body;

    if (!note || typeof note !== 'string' || !note.trim()) {
      return res.status(400).json({ error: 'Verification note is required' });
    }

    const request = await prisma.leaveRequest.findUnique({
      where: { id },
      include: { student: true },
    });

    if (!request) {
      return res.status(404).json({ error: 'Leave request not found' });
    }

    // Verify hostel access
    if (!userHasHostelAccess(req.user, request.hostel_id)) {
      return res.status(403).json({ error: 'You do not have permission to verify leave for this hostel' });
    }

    if (request.status !== 'PENDING') {
      return res.status(400).json({ error: `Cannot verify leave request in ${request.status} status` });
    }

    const updated = await prisma.leaveRequest.update({
      where: { id },
      data: {
        caretaker_verified_by: req.user.id,
        caretaker_verified_at: new Date(),
        caretaker_note: note.trim(),
      },
      include: {
        student: {
          include: {
            user: { select: { id: true, name: true, email: true } },
            room: { select: { room_number: true, floor: true, block: true } },
          },
        },
        hostel: { select: { id: true, name: true, code: true } },
        decider: { select: { id: true, name: true, role: true } },
        caretaker_verifier: { select: { id: true, name: true, role: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        actor_id: req.user.id,
        actor_type: 'USER',
        action: 'LEAVE_REQUEST_CARETAKER_VERIFIED',
        target_type: 'LeaveRequest',
        target_id: id,
        meta: {
          student_id: request.student_id,
          note: note.trim(),
          verifierRole: req.user.role,
        },
      },
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`hostel:${request.hostel_id}`).emit('curfew:leave_request:updated', updated);
      io.to('admin:feed').emit('curfew:leave_request:updated', updated);
    }

    return res.json({
      message: 'Leave request verified by caretaker successfully',
      leave_request: updated,
    });
  } catch (error) {
    console.error('verifyLeaveRequest error:', error);
    return res.status(500).json({ error: 'Failed to verify leave request' });
  }
}

export async function getSelfLeaveRequests(req, res) {
  try {
    const student = await prisma.student.findUnique({
      where: { user_id: req.user.id },
    });

    if (!student) {
      return res.status(404).json({ error: 'Student record not found' });
    }

    const requests = await prisma.leaveRequest.findMany({
      where: { student_id: student.id },
      include: {
        decider: { select: { id: true, name: true, role: true } },
        caretaker_verifier: { select: { id: true, name: true, role: true } },
        hostel: { select: { id: true, name: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    return res.json({ requests });
  } catch (error) {
    console.error('getSelfLeaveRequests error:', error);
    return res.status(500).json({ error: 'Failed to retrieve leave requests' });
  }
}

export async function listLeaveRequests(req, res) {
  try {
    const { status, hostel_id, risk_tier, page = '1', limit = '50' } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const where = {};

    // Scope by staff hostel assignments
    const hostelIds = getUserHostelIds(req.user);
    if (hostelIds !== null) {
      if (hostel_id && hostelIds.includes(hostel_id)) {
        where.hostel_id = hostel_id;
      } else {
        where.hostel_id = { in: hostelIds };
      }
    } else if (hostel_id) {
      where.hostel_id = hostel_id;
    }

    if (status) {
      where.status = status;
    }

    if (risk_tier && ['LOW', 'HIGH'].includes(risk_tier)) {
      where.risk_tier = risk_tier;
    }

    const [total, requests] = await Promise.all([
      prisma.leaveRequest.count({ where }),
      prisma.leaveRequest.findMany({
        where,
        include: {
          student: {
            include: {
              user: { select: { id: true, name: true, email: true } },
              room: { select: { room_number: true, floor: true, block: true } },
            },
          },
          hostel: { select: { id: true, name: true, code: true } },
          decider: { select: { id: true, name: true, role: true } },
          caretaker_verifier: { select: { id: true, name: true, role: true } },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limitNum,
      }),
    ]);

    return res.json({
      requests,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('listLeaveRequests error:', error);
    return res.status(500).json({ error: 'Failed to list leave requests' });
  }
}

export async function updateLeaveRequestStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ error: 'Status must be APPROVED or REJECTED' });
    }

    const request = await prisma.leaveRequest.findUnique({
      where: { id },
      include: { student: true },
    });

    if (!request) {
      return res.status(404).json({ error: 'Leave request not found' });
    }

    // Verify hostel access
    if (!userHasHostelAccess(req.user, request.hostel_id)) {
      return res.status(403).json({ error: 'You do not have permission to manage leave for this hostel' });
    }

    // Risk tier rule: HIGH tier requires WARDEN or VICE_WARDEN (or SUPER_ADMIN)
    if (request.risk_tier === 'HIGH' && req.user.role === 'CARETAKER') {
      return res.status(403).json({
        error: 'High-risk leave requests require Warden or Vice Warden decision. Caretakers can only submit verification.',
        code: 'TIER_REQUIRES_WARDEN',
      });
    }

    const updated = await prisma.leaveRequest.update({
      where: { id },
      data: {
        status,
        decided_by: req.user.id,
        decided_at: new Date(),
      },
      include: {
        student: {
          include: {
            user: { select: { id: true, name: true, email: true } },
            room: { select: { room_number: true, floor: true, block: true } },
          },
        },
        hostel: { select: { id: true, name: true, code: true } },
        decider: { select: { id: true, name: true, role: true } },
        caretaker_verifier: { select: { id: true, name: true, role: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        actor_id: req.user.id,
        actor_type: 'USER',
        action: `LEAVE_REQUEST_${status}`,
        target_type: 'LeaveRequest',
        target_id: id,
        meta: {
          student_id: request.student_id,
          status,
          risk_tier: request.risk_tier,
          deciderRole: req.user.role,
        },
      },
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`hostel:${request.hostel_id}`).emit('curfew:leave_request:updated', updated);
      io.to('admin:feed').emit('curfew:leave_request:updated', updated);
    }

    return res.json({ message: `Leave request ${status.toLowerCase()} successfully`, leave_request: updated });
  } catch (error) {
    console.error('updateLeaveRequestStatus error:', error);
    return res.status(500).json({ error: 'Failed to update leave request status' });
  }
}

export async function cancelLeaveRequest(req, res) {
  try {
    const { id } = req.params;
    const student = await prisma.student.findUnique({
      where: { user_id: req.user.id },
    });

    if (!student) {
      return res.status(404).json({ error: 'Student record not found' });
    }

    const request = await prisma.leaveRequest.findUnique({
      where: { id },
    });

    if (!request || request.student_id !== student.id) {
      return res.status(404).json({ error: 'Leave request not found or not owned by you' });
    }

    const now = new Date();
    // Student can only cancel before requested_from
    if (now >= request.requested_from) {
      return res.status(400).json({
        error: 'Cannot cancel a leave request after the requested start time has already begun',
      });
    }

    if (request.status === 'CANCELLED' || request.status === 'REJECTED') {
      return res.status(400).json({ error: `Cannot cancel a request that is already ${request.status}` });
    }

    const updated = await prisma.leaveRequest.update({
      where: { id },
      data: {
        status: 'CANCELLED',
      },
      include: {
        student: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
        hostel: { select: { id: true, name: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        actor_id: req.user.id,
        actor_type: 'USER',
        action: 'LEAVE_REQUEST_CANCELLED',
        target_type: 'LeaveRequest',
        target_id: id,
        meta: { student_id: student.id },
      },
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`hostel:${request.hostel_id}`).emit('curfew:leave_request:updated', updated);
      io.to('admin:feed').emit('curfew:leave_request:updated', updated);
    }

    return res.json({ message: 'Leave request cancelled successfully', leave_request: updated });
  } catch (error) {
    console.error('cancelLeaveRequest error:', error);
    return res.status(500).json({ error: 'Failed to cancel leave request' });
  }
}

// --- 3. Curfew Alerts Handlers ---

export async function listCurfewAlerts(req, res) {
  try {
    const { status, alert_type, hostel_id, page = '1', limit = '50' } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const where = {};

    // Scope by staff hostel assignments
    const hostelIds = getUserHostelIds(req.user);
    if (hostelIds !== null) {
      if (hostel_id && hostelIds.includes(hostel_id)) {
        where.hostel_id = hostel_id;
      } else {
        where.hostel_id = { in: hostelIds };
      }
    } else if (hostel_id) {
      where.hostel_id = hostel_id;
    }

    if (status) {
      where.status = status;
    }

    if (alert_type) {
      where.alert_type = alert_type;
    }

    const [total, alerts] = await Promise.all([
      prisma.curfewAlert.count({ where }),
      prisma.curfewAlert.findMany({
        where,
        include: {
          student: {
            include: {
              user: { select: { id: true, name: true, email: true } },
              room: { select: { room_number: true, floor: true, block: true } },
            },
          },
          hostel: { select: { id: true, name: true, code: true } },
          resolver: { select: { id: true, name: true, role: true } },
          related_attendance: {
            include: { gate: { select: { name: true } } },
          },
        },
        orderBy: { triggered_at: 'desc' },
        skip,
        take: limitNum,
      }),
    ]);

    // Compute visual escalation:
    // "An alert that's still OPEN when the curfew window ends should be visually escalated on the dashboard"
    const now = new Date();
    const formattedAlerts = await Promise.all(
      alerts.map(async (alert) => {
        let is_escalated = false;
        if (alert.status === 'OPEN') {
          const { inCurfew } = await isStudentInCurfew(alert.hostel_id, now);
          // If not currently in curfew window, or more than 8 hours since triggered
          const hoursSinceTriggered = (now.getTime() - new Date(alert.triggered_at).getTime()) / (1000 * 60 * 60);
          if (!inCurfew || hoursSinceTriggered >= 8) {
            is_escalated = true;
          }
        }
        return {
          ...alert,
          is_escalated,
        };
      })
    );

    return res.json({
      alerts: formattedAlerts,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('listCurfewAlerts error:', error);
    return res.status(500).json({ error: 'Failed to retrieve curfew alerts' });
  }
}

export async function resolveCurfewAlert(req, res) {
  try {
    const { id } = req.params;
    const parseResult = resolveAlertSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Validation failed', details: parseResult.error.flatten() });
    }

    const { status, resolution_note } = parseResult.data;

    const alert = await prisma.curfewAlert.findUnique({
      where: { id },
      include: { student: true },
    });

    if (!alert) {
      return res.status(404).json({ error: 'Curfew alert not found' });
    }

    if (!userHasHostelAccess(req.user, alert.hostel_id)) {
      return res.status(403).json({ error: 'You do not have permission to resolve alerts for this hostel' });
    }

    const updated = await prisma.curfewAlert.update({
      where: { id },
      data: {
        status,
        resolution_note,
        resolved_by: req.user.id,
        resolved_at: new Date(),
      },
      include: {
        student: {
          include: {
            user: { select: { id: true, name: true, email: true } },
            room: { select: { room_number: true, floor: true, block: true } },
          },
        },
        hostel: { select: { id: true, name: true, code: true } },
        resolver: { select: { id: true, name: true, role: true } },
      },
    });

    // Mandatory audit log for alert resolution
    await prisma.auditLog.create({
      data: {
        actor_id: req.user.id,
        actor_type: 'USER',
        action: `CURFEW_ALERT_${status}`,
        target_type: 'CurfewAlert',
        target_id: id,
        reason: resolution_note,
        meta: {
          student_id: alert.student_id,
          hostel_id: alert.hostel_id,
          status,
          alert_type: alert.alert_type,
        },
      },
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`hostel:${alert.hostel_id}`).emit('curfew:alert_updated', updated);
      io.to('admin:feed').emit('curfew:alert_updated', updated);
      io.to('admin:curfew').emit('curfew:alert_updated', updated);
    }

    return res.json({
      message: `Curfew alert ${status.toLowerCase()} successfully`,
      alert: updated,
    });
  } catch (error) {
    console.error('resolveCurfewAlert error:', error);
    return res.status(500).json({ error: 'Failed to resolve curfew alert' });
  }
}

// --- 4. Device Presence Signals Handlers ---
// ADVISORY-ONLY: Stand-in for real WiFi controller/RADIUS integration.
// NEVER used to drive alerts, attendance calculations, or occupancy counts.

export async function ingestPresenceSignal(req, res) {
  try {
    const parseResult = presenceSignalSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Validation failed', details: parseResult.error.flatten() });
    }

    const { student_id, event_type, hostel_id, timestamp } = parseResult.data;

    let targetHostelId = hostel_id;
    if (!targetHostelId) {
      const student = await prisma.student.findUnique({
        where: { id: student_id },
        select: { hostel_id: true },
      });
      if (!student) {
        return res.status(404).json({ error: 'Student not found' });
      }
      targetHostelId = student.hostel_id;
    }

    const signal = await prisma.devicePresenceSignal.create({
      data: {
        student_id,
        event_type,
        hostel_id: targetHostelId,
        timestamp: timestamp ? new Date(timestamp) : new Date(),
      },
    });

    return res.status(201).json({
      message: 'Device presence signal recorded (advisory-only)',
      signal,
    });
  } catch (error) {
    console.error('ingestPresenceSignal error:', error);
    return res.status(500).json({ error: 'Failed to ingest presence signal' });
  }
}

export async function getStudentPresenceHint(req, res) {
  try {
    const { studentId } = req.params;

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, current_state: true },
    });

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Only surface for students already logged INSIDE by attendance system
    if (student.current_state !== 'INSIDE') {
      return res.json({
        inside: false,
        hint: null,
      });
    }

    const lastConnected = await prisma.devicePresenceSignal.findFirst({
      where: {
        student_id: studentId,
        event_type: 'CONNECTED',
      },
      orderBy: { timestamp: 'desc' },
    });

    if (!lastConnected) {
      return res.json({
        inside: true,
        hint: null,
      });
    }

    const minutesAgo = Math.max(0, Math.round((Date.now() - new Date(lastConnected.timestamp).getTime()) / 60000));

    return res.json({
      inside: true,
      hint: `Last seen on hostel WiFi: ${minutesAgo}m ago`,
      last_connected_at: lastConnected.timestamp,
      minutes_ago: minutesAgo,
    });
  } catch (error) {
    console.error('getStudentPresenceHint error:', error);
    return res.status(500).json({ error: 'Failed to retrieve presence hint' });
  }
}
