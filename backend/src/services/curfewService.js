import prisma from '../prisma.js';

/**
 * Checks whether a given Date matches a DayType (EVERYDAY, WEEKDAY, WEEKEND)
 * @param {'EVERYDAY'|'WEEKDAY'|'WEEKEND'} dayType
 * @param {Date} date
 * @returns {boolean}
 */
export function isDayMatching(dayType, date) {
  if (!dayType || dayType === 'EVERYDAY') return true;
  const day = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const isWeekend = (day === 0 || day === 6);
  if (dayType === 'WEEKEND') return isWeekend;
  if (dayType === 'WEEKDAY') return !isWeekend;
  return true;
}

/**
 * Parses "HH:mm" or "HH:mm:ss" into minutes from midnight (0-1439)
 * @param {string} timeStr
 * @returns {number}
 */
export function timeStrToMinutes(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

/**
 * Checks whether a given Date is inside a CurfewWindow, accounting for:
 * - day_type (EVERYDAY, WEEKDAY, WEEKEND)
 * - midnight wrap (e.g. 21:00 to 06:00 where end_time < start_time)
 * @param {object} window - CurfewWindow row
 * @param {Date} date - Date to test
 * @returns {boolean}
 */
export function isDateInCurfewWindow(window, date = new Date()) {
  if (!window || !window.is_active) return false;

  const startMin = timeStrToMinutes(window.start_time);
  const endMin = timeStrToMinutes(window.end_time);
  const currentMin = date.getHours() * 60 + date.getMinutes();

  if (startMin <= endMin) {
    // Standard daytime / same-day window (e.g. 14:00 to 18:00)
    if (!isDayMatching(window.day_type, date)) return false;
    return currentMin >= startMin && currentMin < endMin;
  } else {
    // Midnight wrap window (e.g. 21:00 to 06:00)
    // Option A: evening portion of today (>= 21:00)
    if (currentMin >= startMin) {
      return isDayMatching(window.day_type, date);
    }
    // Option B: early morning portion of today (< 06:00)
    if (currentMin < endMin) {
      // The window started yesterday evening, so yesterday must match day_type
      const yesterday = new Date(date.getTime() - 24 * 60 * 60 * 1000);
      return isDayMatching(window.day_type, yesterday);
    }
    return false;
  }
}

/**
 * Fetches active curfew windows for a specific hostel.
 * Falls back to campus-wide default rows (hostel_id IS NULL) if no specific row is configured.
 * @param {string|null} hostelId
 * @param {object} [tx] Prisma client or transaction
 * @returns {Promise<Array>}
 */
export async function getActiveCurfewWindowsForHostel(hostelId, tx = prisma) {
  if (hostelId) {
    const hostelWindows = await tx.curfewWindow.findMany({
      where: {
        hostel_id: hostelId,
        is_active: true,
      },
    });
    if (hostelWindows.length > 0) {
      return hostelWindows;
    }
  }

  // Campus-wide default (hostel_id is NULL)
  const campusDefaults = await tx.curfewWindow.findMany({
    where: {
      hostel_id: null,
      is_active: true,
    },
  });
  return campusDefaults;
}

/**
 * Checks if a student/hostel is currently within an active curfew window.
 * @param {string} hostelId
 * @param {Date} [date]
 * @param {object} [tx]
 * @returns {Promise<{ inCurfew: boolean, window: object|null }>}
 */
export async function isStudentInCurfew(hostelId, date = new Date(), tx = prisma) {
  const windows = await getActiveCurfewWindowsForHostel(hostelId, tx);
  for (const win of windows) {
    if (isDateInCurfewWindow(win, date)) {
      return { inCurfew: true, window: win };
    }
  }
  return { inCurfew: false, window: null };
}

/**
 * Checks whether an approved leave request covers the student at the given time.
 * @param {string} studentId
 * @param {Date} [date]
 * @param {object} [tx]
 * @returns {Promise<object|null>}
 */
export async function getCoveringApprovedLeave(studentId, date = new Date(), tx = prisma) {
  return await tx.leaveRequest.findFirst({
    where: {
      student_id: studentId,
      status: 'APPROVED',
      requested_from: { lte: date },
      requested_to: { gte: date },
    },
  });
}

/**
 * Finds students of a hostel currently OUTSIDE who do not have an approved leave covering date.
 * @param {string} hostelId
 * @param {Date} [date]
 * @param {object} [tx]
 * @returns {Promise<Array>}
 */
export async function findStudentsOutsideWithoutLeave(hostelId, date = new Date(), tx = prisma) {
  const outsideStudents = await tx.student.findMany({
    where: {
      hostel_id: hostelId,
      current_state: 'OUTSIDE',
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
      room: { select: { id: true, room_number: true, floor: true, block: true } },
    },
  });

  const studentsWithoutLeave = [];
  for (const st of outsideStudents) {
    const leave = await getCoveringApprovedLeave(st.id, date, tx);
    if (!leave) {
      studentsWithoutLeave.push(st);
    }
  }

  return studentsWithoutLeave;
}

/**
 * Executes Job A: curfew-start sweep.
 * 1. Checks students OUTSIDE without approved leave.
 * 2. If grace_period_minutes > 0 and not skipping delay, schedules delayed recheck.
 * 3. On recheck, inserts OVERNIGHT_NOT_RETURNED alerts (OPEN) and notifies Socket.IO.
 * @param {object} params
 * @param {string} params.hostelId
 * @param {object} params.window
 * @param {object} [params.io] Socket.IO instance
 * @param {boolean} [params.skipDelay] If true, rechecks and creates alerts immediately (e.g. testing)
 * @returns {Promise<{ scheduled: boolean, initialCount: number, alertsCreated?: Array }>}
 */
export async function triggerCurfewSweep({ hostelId, window, io, skipDelay = false }) {
  const now = new Date();
  const initialOutside = await findStudentsOutsideWithoutLeave(hostelId, now);

  if (initialOutside.length === 0) {
    return { scheduled: false, initialCount: 0, alertsCreated: [] };
  }

  const graceMinutes = window.grace_period_minutes || 0;

  if (skipDelay || graceMinutes === 0) {
    const createdAlerts = await executeCurfewSweepRecheck(hostelId, window, io);
    return { scheduled: false, initialCount: initialOutside.length, alertsCreated: createdAlerts };
  }

  // Schedule delayed re-check without blocking the job
  const graceMs = graceMinutes * 60 * 1000;
  setTimeout(async () => {
    try {
      await executeCurfewSweepRecheck(hostelId, window, io);
    } catch (err) {
      console.error(`[CurfewSweep] Delayed recheck error for hostel ${hostelId}:`, err);
    }
  }, graceMs);

  return { scheduled: true, initialCount: initialOutside.length, graceMinutes };
}

/**
 * Re-checks students still OUTSIDE without approved leave and creates OVERNIGHT_NOT_RETURNED alerts.
 * @param {string} hostelId
 * @param {object} window
 * @param {object} [io]
 * @returns {Promise<Array>} Array of created CurfewAlert objects
 */
export async function executeCurfewSweepRecheck(hostelId, window, io) {
  const recheckTime = new Date();
  const stillOutside = await findStudentsOutsideWithoutLeave(hostelId, recheckTime);
  const createdAlerts = [];

  for (const student of stillOutside) {
    // Avoid duplicate open overnight alerts for this student within 12 hours
    const existing = await prisma.curfewAlert.findFirst({
      where: {
        student_id: student.id,
        alert_type: 'OVERNIGHT_NOT_RETURNED',
        status: 'OPEN',
        triggered_at: {
          gte: new Date(recheckTime.getTime() - 12 * 60 * 60 * 1000),
        },
      },
    });

    if (!existing) {
      const alert = await prisma.curfewAlert.create({
        data: {
          student_id: student.id,
          hostel_id: hostelId,
          alert_type: 'OVERNIGHT_NOT_RETURNED',
          status: 'OPEN',
          triggered_at: recheckTime,
        },
        include: {
          student: {
            include: {
              user: { select: { id: true, name: true, email: true } },
              room: { select: { room_number: true, floor: true, block: true } },
            },
          },
          hostel: { select: { id: true, name: true, code: true } },
        },
      });

      createdAlerts.push(alert);

      if (io) {
        io.to(`hostel:${hostelId}`).emit('curfew:alert', alert);
        io.to('admin:feed').emit('curfew:alert', alert);
        io.to('admin:curfew').emit('curfew:alert', alert);
      }
    }
  }

  return createdAlerts;
}

/**
 * Calculates risk tier for a leave request:
 * - HIGH if the request spans any part of an active curfew_windows entry for that hostel,
 * - or if requested_to - requested_from exceeds max_low_risk_hours (default 8)
 * - LOW otherwise.
 * @param {string} hostelId
 * @param {Date|string} requestedFrom
 * @param {Date|string} requestedTo
 * @param {object} [tx]
 * @returns {Promise<'LOW'|'HIGH'>}
 */
export async function calculateLeaveRiskTier(hostelId, requestedFrom, requestedTo, tx = prisma) {
  const from = new Date(requestedFrom);
  const to = new Date(requestedTo);

  const durationMs = to.getTime() - from.getTime();
  const durationHours = durationMs / (1000 * 60 * 60);

  // 1. Fetch active windows for hostel (or campus defaults)
  const windows = await getActiveCurfewWindowsForHostel(hostelId, tx);

  // Threshold: use minimum configured max_low_risk_hours among active windows, or 8
  let thresholdHours = 8;
  if (windows.length > 0) {
    const configuredThresholds = windows
      .map((w) => w.max_low_risk_hours)
      .filter((t) => t != null && !isNaN(t));
    if (configuredThresholds.length > 0) {
      thresholdHours = Math.min(...configuredThresholds);
    }
  }

  // If duration exceeds threshold, it's HIGH risk
  if (durationHours > thresholdHours) {
    return 'HIGH';
  }

  // 2. Check if request spans any part of active curfew windows
  if (windows.length > 0) {
    // Step by 10 minutes between `from` and `to`
    const stepMs = 10 * 60 * 1000;
    for (let t = from.getTime(); t <= to.getTime(); t += stepMs) {
      const checkDate = new Date(t);
      for (const win of windows) {
        if (isDateInCurfewWindow(win, checkDate)) {
          return 'HIGH';
        }
      }
    }
    // Also check endpoint `to`
    for (const win of windows) {
      if (isDateInCurfewWindow(win, to)) {
        return 'HIGH';
      }
    }
  }

  return 'LOW';
}

