import prisma from '../prisma.js';
import { validateAndConsume } from '../services/qrTokenService.js';

/**
 * 6.1 & 6.2 POST /api/attendance/scan
 * Endpoint for students scanning a QR code from a gate or mess kiosk display.
 * Derives direction from student's current_state (INSIDE -> EXIT, OUTSIDE -> ENTRY).
 * Updates attendance log and persists current_state atomically.
 * Emits Socket.IO events (6.4) and triggers kiosk confirmation flash (6.5).
 */
export async function scanAttendance(req, res) {
  try {
    const { token } = req.body;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Token string is required', code: 'MISSING_TOKEN' });
    }

    // 1. Fetch student record for authenticated user
    const student = await prisma.student.findUnique({
      where: { user_id: req.user.id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        hostel: { select: { id: true, code: true, name: true, type: true } },
        room: { select: { id: true, room_number: true, floor: true, block: true } },
      },
    });

    if (!student) {
      return res.status(404).json({ error: 'Student record not found for this account', code: 'STUDENT_NOT_FOUND' });
    }

    // 2. Validate and consume the QR token (atomically marks status: USED)
    const consumeResult = await validateAndConsume(token.trim());

    if (!consumeResult.valid) {
      // 6.6 Audit log for failed scan attempt
      await prisma.auditLog.create({
        data: {
          actor_id: req.user.id,
          actor_type: 'USER',
          action: 'SCAN_FAILED',
          target_type: 'QrToken',
          meta: {
            reason: consumeResult.code,
            errorMessage: consumeResult.error,
            studentId: student.id,
            rollNumber: student.roll_number,
          },
        },
      }).catch((err) => console.error('Failed to log scan failure audit:', err));

      const statusMap = {
        TOKEN_NOT_FOUND: 404,
        TOKEN_ALREADY_USED: 409,
        TOKEN_EXPIRED: 410,
        TOKEN_REVOKED: 410,
        DEVICE_INACTIVE: 403,
      };

      const statusCode = statusMap[consumeResult.code] || 400;
      return res.status(statusCode).json({
        error: consumeResult.error || 'Invalid QR code',
        code: consumeResult.code,
      });
    }

    const qrToken = consumeResult.token;

    // 3. Branch: GATE vs MESS
    if (qrToken.purpose === 'GATE') {
      // Security check: verify student is assigned to this gate's hostel
      if (qrToken.gate.hostel_id !== student.hostel_id) {
        return res.status(403).json({
          error: `Hostel Mismatch: You are assigned to ${student.hostel.name}, but this gate is at ${qrToken.gate.hostel?.name || 'another hostel'}.`,
          code: 'HOSTEL_MISMATCH',
        });
      }

      // 6.2 Derive direction from current_state
      const currentDirection = student.current_state === 'INSIDE' ? 'EXIT' : 'ENTRY';
      const nextState = currentDirection === 'EXIT' ? 'OUTSIDE' : 'INSIDE';

      // Atomic database transaction: create attendance, update student current_state, create audit log
      const { attendance, updatedStudent } = await prisma.$transaction(async (tx) => {
        const attendanceRecord = await tx.hostelAttendance.create({
          data: {
            student_id: student.id,
            hostel_id: qrToken.gate.hostel_id,
            gate_id: qrToken.gate_id,
            device_id: qrToken.device_id,
            direction: currentDirection,
            qr_token_id: qrToken.id,
          },
          include: {
            gate: true,
            hostel: true,
          },
        });

        const studentUpdated = await tx.student.update({
          where: { id: student.id },
          data: {
            current_state: nextState,
          },
        });

        // 6.6 Scan audit log
        await tx.auditLog.create({
          data: {
            actor_id: req.user.id,
            actor_type: 'USER',
            action: `HOSTEL_SCAN_${currentDirection}`,
            target_type: 'HostelAttendance',
            target_id: attendanceRecord.id,
            meta: {
              studentId: student.id,
              rollNumber: student.roll_number,
              direction: currentDirection,
              previousState: student.current_state,
              newState: nextState,
              gateId: qrToken.gate_id,
              gateName: qrToken.gate.name,
              hostelId: qrToken.gate.hostel_id,
              deviceId: qrToken.device_id,
            },
          },
        });

        return { attendance: attendanceRecord, updatedStudent: studentUpdated };
      });

      // 6.4 & 6.5 Socket.IO event emission
      const io = req.app.get('io');
      if (io) {
        const timestampStr = new Date().toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        });

        // 6.5 Kiosk confirmation flash (anti-proxy visual display for 5s)
        io.to(`device:${qrToken.device_id}`).emit('display:confirm', {
          studentName: student.user.name,
          rollNumber: student.roll_number,
          photoUrl: student.photo_url,
          direction: currentDirection,
          timestamp: timestampStr,
        });

        // Real-time live feed to Warden dashboard (hostel-scoped room)
        io.to(`hostel:${qrToken.gate.hostel_id}`).emit('attendance:new', {
          id: attendance.id,
          type: 'HOSTEL',
          student: {
            id: student.id,
            name: student.user.name,
            rollNumber: student.roll_number,
            roomNumber: student.room?.room_number,
          },
          gateName: qrToken.gate.name,
          direction: currentDirection,
          scannedAt: attendance.scanned_at,
        });

        // Real-time feed to Super Admin dashboard
        io.to('admin:feed').emit('attendance:new', {
          id: attendance.id,
          type: 'HOSTEL',
          hostelName: qrToken.gate.hostel?.name,
          student: {
            id: student.id,
            name: student.user.name,
            rollNumber: student.roll_number,
            roomNumber: student.room?.room_number,
          },
          gateName: qrToken.gate.name,
          direction: currentDirection,
          scannedAt: attendance.scanned_at,
        });
      }

      return res.status(200).json({
        message: `${currentDirection} recorded successfully`,
        direction: currentDirection,
        student_state: nextState,
        attendance: {
          id: attendance.id,
          direction: currentDirection,
          gate: qrToken.gate.name,
          hostel: qrToken.gate.hostel?.name,
          scanned_at: attendance.scanned_at,
        },
      });
    } else if (qrToken.purpose === 'MESS') {
      // Mess Scan Flow (Phase 7 compatibility)
      if (!qrToken.meal_window) {
        return res.status(400).json({
          error: 'No active meal window is currently scheduled for this mess counter.',
          code: 'NO_ACTIVE_MEAL_WINDOW',
        });
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Check duplicate meal attendance for this meal window today
      const existing = await prisma.messAttendance.findFirst({
        where: {
          student_id: student.id,
          meal_window_id: qrToken.meal_window_id,
          date: today,
        },
      });

      if (existing) {
        return res.status(409).json({
          error: `You have already claimed ${qrToken.meal_window.meal_type} today.`,
          code: 'DUPLICATE_MEAL',
        });
      }

      const messAttendance = await prisma.$transaction(async (tx) => {
        const record = await tx.messAttendance.create({
          data: {
            student_id: student.id,
            mess_id: qrToken.mess_id,
            meal_window_id: qrToken.meal_window_id,
            device_id: qrToken.device_id,
            meal_type: qrToken.meal_window.meal_type,
            date: today,
            qr_token_id: qrToken.id,
          },
          include: {
            mess: true,
            meal_window: true,
          },
        });

        await tx.auditLog.create({
          data: {
            actor_id: req.user.id,
            actor_type: 'USER',
            action: 'MESS_MEAL_CLAIMED',
            target_type: 'MessAttendance',
            target_id: record.id,
            meta: {
              studentId: student.id,
              mealType: qrToken.meal_window.meal_type,
              messId: qrToken.mess_id,
            },
          },
        });

        return record;
      });

      // Socket.IO confirmation
      const io = req.app.get('io');
      if (io) {
        io.to(`device:${qrToken.device_id}`).emit('display:confirm', {
          studentName: student.user.name,
          rollNumber: student.roll_number,
          photoUrl: student.photo_url,
          mealType: qrToken.meal_window.meal_type,
          timestamp: new Date().toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true,
          }),
        });

        io.to(`mess:${qrToken.mess_id}`).emit('mess:attendance:new', {
          id: messAttendance.id,
          student: {
            id: student.id,
            name: student.user.name,
            rollNumber: student.roll_number,
          },
          mealType: qrToken.meal_window.meal_type,
          scannedAt: messAttendance.scanned_at,
        });
      }

      return res.status(200).json({
        message: `${qrToken.meal_window.meal_type} meal recorded successfully`,
        meal_type: qrToken.meal_window.meal_type,
        mess: qrToken.mess?.name,
        attendance: messAttendance,
      });
    } else {
      return res.status(400).json({ error: 'Unknown QR token purpose', code: 'INVALID_PURPOSE' });
    }
  } catch (error) {
    console.error('Error in scanAttendance:', error);
    return res.status(500).json({ error: 'Internal server error processing scan' });
  }
}

/**
 * 6.8 GET /api/attendance/self
 * Returns the authenticated student's profile information, current state,
 * and recent hostel & mess attendance logs.
 */
export async function getSelfHistory(req, res) {
  try {
    const student = await prisma.student.findUnique({
      where: { user_id: req.user.id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        hostel: { select: { id: true, code: true, name: true, type: true, location: true } },
        room: { select: { id: true, room_number: true, floor: true, block: true } },
      },
    });

    if (!student) {
      return res.status(404).json({ error: 'Student record not found for this user' });
    }

    // Fetch recent 30 hostel attendance events
    const hostelLogs = await prisma.hostelAttendance.findMany({
      where: { student_id: student.id },
      orderBy: { scanned_at: 'desc' },
      take: 30,
      include: {
        gate: { select: { id: true, name: true } },
        hostel: { select: { id: true, name: true, code: true } },
      },
    });

    // Fetch recent 30 mess attendance events
    const messLogs = await prisma.messAttendance.findMany({
      where: { student_id: student.id },
      orderBy: { scanned_at: 'desc' },
      take: 30,
      include: {
        mess: { select: { id: true, name: true } },
        meal_window: { select: { id: true, meal_type: true, start_time: true, end_time: true } },
      },
    });

    return res.status(200).json({
      student: {
        id: student.id,
        roll_number: student.roll_number,
        gender: student.gender,
        department: student.department,
        year: student.year,
        photo_url: student.photo_url,
        current_state: student.current_state,
        user: student.user,
        hostel: student.hostel,
        room: student.room,
      },
      hostel_logs: hostelLogs,
      mess_logs: messLogs,
    });
  } catch (error) {
    console.error('Error fetching self history:', error);
    return res.status(500).json({ error: 'Failed to fetch attendance history' });
  }
}
