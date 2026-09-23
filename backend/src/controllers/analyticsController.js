import prisma from '../prisma.js';

/**
 * 10.1 GET /api/analytics/occupancy-history
 * Returns historical entry/exit flows and estimated daily occupancy curves.
 * Scoped by role: WARDEN (own hostels only), SUPER_ADMIN (any or campus-wide).
 */
export async function getOccupancyHistory(req, res) {
  try {
    const { hostel_id, days = '7' } = req.query;
    const numDays = Math.min(60, Math.max(1, parseInt(days, 10) || 7));

    let targetHostelId = hostel_id;

    if (req.user.role === 'WARDEN') {
      const wardenHostels = await prisma.hostel.findMany({
        where: { warden_id: req.user.id },
        select: { id: true, name: true, total_capacity: true },
      });
      if (wardenHostels.length === 0) {
        return res.status(403).json({ error: 'No hostels assigned to your warden account' });
      }
      if (!targetHostelId) {
        targetHostelId = wardenHostels[0].id;
      } else {
        const hasAccess = wardenHostels.some((h) => h.id === targetHostelId);
        if (!hasAccess) {
          return res.status(403).json({ error: 'Access denied: you do not manage this hostel' });
        }
      }
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (numDays - 1));
    startDate.setHours(0, 0, 0, 0);

    const whereClause = {
      scanned_at: { gte: startDate },
    };
    if (targetHostelId) {
      whereClause.hostel_id = targetHostelId;
    }

    // Fetch all attendance events in the window
    const events = await prisma.hostelAttendance.findMany({
      where: whereClause,
      select: {
        direction: true,
        scanned_at: true,
      },
      orderBy: { scanned_at: 'asc' },
    });

    // Bucket by day (YYYY-MM-DD)
    const timelineMap = new Map();
    for (let i = 0; i < numDays; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().split('T')[0];
      timelineMap.set(key, {
        date: key,
        displayDate: d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
        entries: 0,
        exits: 0,
        netFlow: 0,
      });
    }

    // Bucket by hour of day (0-23) for peak flow detection
    const hourlyPeaks = Array.from({ length: 24 }, (_, hour) => ({
      hour: `${hour.toString().padStart(2, '0')}:00`,
      entries: 0,
      exits: 0,
    }));

    for (const ev of events) {
      const dateKey = ev.scanned_at.toISOString().split('T')[0];
      if (timelineMap.has(dateKey)) {
        const item = timelineMap.get(dateKey);
        if (ev.direction === 'ENTRY') {
          item.entries++;
        } else {
          item.exits++;
        }
        item.netFlow = item.entries - item.exits;
      }

      const h = ev.scanned_at.getHours();
      if (hourlyPeaks[h]) {
        if (ev.direction === 'ENTRY') {
          hourlyPeaks[h].entries++;
        } else {
          hourlyPeaks[h].exits++;
        }
      }
    }

    const timeline = Array.from(timelineMap.values());

    // Compute summary stats
    const totalEntries = timeline.reduce((acc, t) => acc + t.entries, 0);
    const totalExits = timeline.reduce((acc, t) => acc + t.exits, 0);
    const avgDailyEntries = Math.round(totalEntries / numDays);

    let hostelMeta = null;
    if (targetHostelId) {
      hostelMeta = await prisma.hostel.findUnique({
        where: { id: targetHostelId },
        select: { id: true, name: true, code: true, total_capacity: true },
      });
    }

    return res.json({
      hostel: hostelMeta,
      rangeDays: numDays,
      summary: {
        totalEntries,
        totalExits,
        avgDailyEntries,
      },
      timeline,
      hourlyPeaks,
    });
  } catch (error) {
    console.error('Occupancy history error:', error);
    return res.status(500).json({ error: 'Internal server error calculating occupancy history' });
  }
}

/**
 * 10.2 GET /api/analytics/meal-trends
 * Returns daily meal attendance trends broken down by meal type.
 * Scoped by role: MESS_ADMIN (own mess only), SUPER_ADMIN (any or campus-wide).
 */
export async function getMealTrends(req, res) {
  try {
    const { mess_id, days = '7' } = req.query;
    const numDays = Math.min(60, Math.max(1, parseInt(days, 10) || 7));

    let targetMessId = mess_id;

    if (req.user.role === 'MESS_ADMIN') {
      const userMesses = await prisma.mess.findMany({
        where: { mess_admin_id: req.user.id },
        select: { id: true, name: true },
      });
      if (userMesses.length === 0) {
        return res.status(403).json({ error: 'No messes assigned to your admin account' });
      }
      if (!targetMessId) {
        targetMessId = userMesses[0].id;
      } else {
        const hasAccess = userMesses.some((m) => m.id === targetMessId);
        if (!hasAccess) {
          return res.status(403).json({ error: 'Access denied: you do not manage this mess' });
        }
      }
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (numDays - 1));
    startDate.setHours(0, 0, 0, 0);

    const whereClause = {
      date: { gte: startDate },
    };
    if (targetMessId) {
      whereClause.mess_id = targetMessId;
    }

    const records = await prisma.messAttendance.findMany({
      where: whereClause,
      select: {
        meal_type: true,
        date: true,
      },
      orderBy: { date: 'asc' },
    });

    const timelineMap = new Map();
    for (let i = 0; i < numDays; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().split('T')[0];
      timelineMap.set(key, {
        date: key,
        displayDate: d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
        BREAKFAST: 0,
        LUNCH: 0,
        SNACKS: 0,
        DINNER: 0,
        total: 0,
      });
    }

    const mealTypeCounts = {
      BREAKFAST: 0,
      LUNCH: 0,
      SNACKS: 0,
      DINNER: 0,
    };

    for (const rec of records) {
      const dateKey = rec.date.toISOString().split('T')[0];
      if (timelineMap.has(dateKey)) {
        const item = timelineMap.get(dateKey);
        if (item[rec.meal_type] !== undefined) {
          item[rec.meal_type]++;
          item.total++;
          mealTypeCounts[rec.meal_type]++;
        }
      }
    }

    const timeline = Array.from(timelineMap.values());
    const totalMealsServed = Object.values(mealTypeCounts).reduce((a, b) => a + b, 0);

    let messMeta = null;
    if (targetMessId) {
      messMeta = await prisma.mess.findUnique({
        where: { id: targetMessId },
        select: { id: true, name: true },
      });
    }

    return res.json({
      mess: messMeta,
      rangeDays: numDays,
      summary: {
        totalMealsServed,
        mealTypeCounts,
        avgMealsPerDay: Math.round(totalMealsServed / numDays),
      },
      timeline,
    });
  } catch (error) {
    console.error('Meal trends error:', error);
    return res.status(500).json({ error: 'Internal server error calculating meal trends' });
  }
}

/**
 * 10.3 GET /api/analytics/export
 * Generates and downloads audit and operational reports as CSV.
 * Supported types: hostel_attendance, mess_attendance, occupancy_summary, meal_summary.
 */
export async function exportReport(req, res) {
  try {
    const { type = 'hostel_attendance', hostel_id, mess_id, days = '30' } = req.query;
    const numDays = Math.min(90, Math.max(1, parseInt(days, 10) || 30));

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (numDays - 1));
    startDate.setHours(0, 0, 0, 0);

    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '';
      const str = String(val).replace(/"/g, '""');
      return str.includes(',') || str.includes('\n') || str.includes('"') ? `"${str}"` : str;
    };

    const timestampStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

    if (type === 'hostel_attendance') {
      const where = { scanned_at: { gte: startDate } };
      if (req.user.role === 'WARDEN') {
        const wardenHostels = await prisma.hostel.findMany({
          where: { warden_id: req.user.id },
          select: { id: true },
        });
        where.hostel_id = { in: wardenHostels.map((h) => h.id) };
      } else if (hostel_id) {
        where.hostel_id = hostel_id;
      }

      const rows = await prisma.hostelAttendance.findMany({
        where,
        include: {
          student: {
            include: { user: { select: { name: true } }, room: true },
          },
          hostel: { select: { code: true, name: true } },
          gate: { select: { name: true } },
          device: { select: { device_code: true } },
        },
        orderBy: { scanned_at: 'desc' },
        take: 5000,
      });

      const header = ['Scanned At', 'Roll Number', 'Student Name', 'Hostel', 'Room', 'Gate', 'Direction', 'Device Code'];
      const csvLines = [header.join(',')];

      for (const r of rows) {
        csvLines.push(
          [
            escapeCsv(r.scanned_at.toISOString()),
            escapeCsv(r.student.roll_number),
            escapeCsv(r.student.user.name),
            escapeCsv(`${r.hostel.code} - ${r.hostel.name}`),
            escapeCsv(r.student.room?.room_number || ''),
            escapeCsv(r.gate.name),
            escapeCsv(r.direction),
            escapeCsv(r.device.device_code || ''),
          ].join(',')
        );
      }

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="hostel360-gate-attendance-${timestampStr}.csv"`);
      return res.send(csvLines.join('\n'));
    }

    if (type === 'mess_attendance') {
      const where = { date: { gte: startDate } };
      if (req.user.role === 'MESS_ADMIN') {
        const userMesses = await prisma.mess.findMany({
          where: { mess_admin_id: req.user.id },
          select: { id: true },
        });
        where.mess_id = { in: userMesses.map((m) => m.id) };
      } else if (mess_id) {
        where.mess_id = mess_id;
      }

      const rows = await prisma.messAttendance.findMany({
        where,
        include: {
          student: {
            include: { user: { select: { name: true } }, hostel: { select: { code: true } } },
          },
          mess: { select: { name: true } },
          device: { select: { device_code: true } },
        },
        orderBy: { scanned_at: 'desc' },
        take: 5000,
      });

      const header = ['Date', 'Scanned At', 'Roll Number', 'Student Name', 'Hostel', 'Mess', 'Meal Type', 'Device Code'];
      const csvLines = [header.join(',')];

      for (const r of rows) {
        csvLines.push(
          [
            escapeCsv(r.date.toISOString().split('T')[0]),
            escapeCsv(r.scanned_at.toISOString()),
            escapeCsv(r.student.roll_number),
            escapeCsv(r.student.user.name),
            escapeCsv(r.student.hostel?.code || ''),
            escapeCsv(r.mess.name),
            escapeCsv(r.meal_type),
            escapeCsv(r.device.device_code || ''),
          ].join(',')
        );
      }

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="hostel360-mess-attendance-${timestampStr}.csv"`);
      return res.send(csvLines.join('\n'));
    }

    return res.status(400).json({ error: `Unsupported export report type '${type}'. Use hostel_attendance or mess_attendance.` });
  } catch (error) {
    console.error('Export report error:', error);
    return res.status(500).json({ error: 'Internal server error exporting report' });
  }
}
