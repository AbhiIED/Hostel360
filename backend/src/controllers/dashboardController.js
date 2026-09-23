import prisma from '../prisma.js';
import { resolveMealWindow } from '../services/mealWindowService.js';

/**
 * Helper to get today's start and end timestamps
 */
function getTodayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/**
 * 8.6 Super Admin Dashboard API
 * Aggregates high-level metrics, campus occupancy, device health, system alerts, and global feed.
 */
export async function getSuperAdminDashboard(req, res) {
  try {
    const { start: todayStart, end: todayEnd } = getTodayRange();

    const [
      hostelsCount,
      roomsCount,
      studentsCount,
      insideStudentsCount,
      devicesCount,
      activeDevicesCount,
      todayHostelScans,
      todayMessScans,
      hostels,
      inactiveDevices,
      recentAlerts,
      recentActivity,
    ] = await Promise.all([
      prisma.hostel.count(),
      prisma.room.count(),
      prisma.student.count(),
      prisma.student.count({ where: { current_state: 'INSIDE' } }),
      prisma.device.count(),
      prisma.device.count({ where: { is_active: true } }),
      prisma.hostelAttendance.count({
        where: { scanned_at: { gte: todayStart, lte: todayEnd } },
      }),
      prisma.messAttendance.count({
        where: { scanned_at: { gte: todayStart, lte: todayEnd } },
      }),
      prisma.hostel.findMany({
        select: {
          id: true,
          code: true,
          name: true,
          type: true,
          total_capacity: true,
          _count: {
            select: { students: true, rooms: true, gates: true },
          },
        },
        orderBy: { code: 'asc' },
      }),
      prisma.device.findMany({
        where: { is_active: false },
        select: { id: true, device_code: true, device_name: true, purpose: true },
      }),
      prisma.auditLog.findMany({
        where: {
          action: 'SCAN_FAILED',
          created_at: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
        orderBy: { created_at: 'desc' },
        take: 10,
      }),
      prisma.hostelAttendance.findMany({
        take: 15,
        orderBy: { scanned_at: 'desc' },
        include: {
          student: {
            include: { user: { select: { name: true } } },
          },
          gate: { select: { name: true } },
          hostel: { select: { name: true, code: true } },
        },
      }),
    ]);

    // Calculate total campus capacity & occupancy
    const totalCapacity = hostels.reduce((acc, h) => acc + h.total_capacity, 0);
    const outsideStudentsCount = studentsCount - insideStudentsCount;
    const campusOccupancyRate = totalCapacity > 0 ? Math.round((insideStudentsCount / totalCapacity) * 100) : 0;

    return res.status(200).json({
      metrics: {
        hostels_count: hostelsCount,
        rooms_count: roomsCount,
        students_count: studentsCount,
        inside_count: insideStudentsCount,
        outside_count: outsideStudentsCount,
        total_capacity: totalCapacity,
        campus_occupancy_rate: campusOccupancyRate,
        devices_count: devicesCount,
        active_devices_count: activeDevicesCount,
        today_hostel_scans: todayHostelScans,
        today_mess_scans: todayMessScans,
      },
      hostels_summary: hostels,
      alerts: {
        inactive_devices: inactiveDevices,
        failed_scans_24h: recentAlerts.length,
        recent_security_events: recentAlerts,
      },
      recent_activity: recentActivity,
    });
  } catch (error) {
    console.error('Error in getSuperAdminDashboard:', error);
    return res.status(500).json({ error: 'Failed to load Super Admin dashboard data' });
  }
}

/**
 * 8.2 & 8.3 Warden Dashboard API
 * Returns live occupancy, inside/outside counts, and live event stream scoped to Warden's hostels.
 */
export async function getWardenDashboard(req, res) {
  try {
    const user = req.user;
    const { hostelId } = req.query;

    let hostelFilter = {};
    if (user.role === 'WARDEN') {
      hostelFilter = { warden_id: user.id };
    }
    if (hostelId) {
      hostelFilter = { ...hostelFilter, id: hostelId };
    }

    const assignedHostels = await prisma.hostel.findMany({
      where: hostelFilter,
      include: {
        gates: true,
        _count: {
          select: { students: true, rooms: true },
        },
      },
      orderBy: { code: 'asc' },
    });

    if (assignedHostels.length === 0) {
      return res.status(200).json({
        hostels: [],
        occupancy_panels: [],
        recent_events: [],
        message: 'No hostels assigned to this warden account.',
      });
    }

    const hostelIds = assignedHostels.map((h) => h.id);

    // Calculate live occupancy per hostel
    const occupancyPanels = await Promise.all(
      assignedHostels.map(async (h) => {
        const [insideCount, outsideCount] = await Promise.all([
          prisma.student.count({
            where: { hostel_id: h.id, current_state: 'INSIDE' },
          }),
          prisma.student.count({
            where: { hostel_id: h.id, current_state: 'OUTSIDE' },
          }),
        ]);

        const totalStudents = insideCount + outsideCount;
        const vacantBeds = Math.max(0, h.total_capacity - insideCount);
        const occupancyRate = h.total_capacity > 0 ? Math.round((insideCount / h.total_capacity) * 100) : 0;

        return {
          hostel_id: h.id,
          code: h.code,
          name: h.name,
          type: h.type,
          location: h.location,
          total_capacity: h.total_capacity,
          total_students: totalStudents,
          inside_count: insideCount,
          outside_count: outsideCount,
          vacant_beds: vacantBeds,
          occupancy_rate: occupancyRate,
          gates: h.gates,
        };
      })
    );

    // Recent 40 gate attendance events across assigned hostels
    const recentEvents = await prisma.hostelAttendance.findMany({
      where: { hostel_id: { in: hostelIds } },
      orderBy: { scanned_at: 'desc' },
      take: 40,
      include: {
        student: {
          include: {
            user: { select: { name: true } },
            room: { select: { room_number: true } },
          },
        },
        gate: { select: { name: true } },
        hostel: { select: { code: true, name: true } },
      },
    });

    return res.status(200).json({
      hostels: assignedHostels,
      occupancy_panels: occupancyPanels,
      recent_events: recentEvents,
    });
  } catch (error) {
    console.error('Error in getWardenDashboard:', error);
    return res.status(500).json({ error: 'Failed to load Warden dashboard data' });
  }
}

/**
 * 8.4 & 8.5 Mess Admin Dashboard API
 * Returns daily meal counts, active meal window resolver, and live meal attendance feed.
 */
export async function getMessAdminDashboard(req, res) {
  try {
    const user = req.user;
    const { messId } = req.query;
    const { start: todayStart, end: todayEnd } = getTodayRange();

    let messFilter = {};
    if (user.role === 'MESS_ADMIN') {
      messFilter = { mess_admin_id: user.id };
    }
    if (messId) {
      messFilter = { ...messFilter, id: messId };
    }

    const mess = await prisma.mess.findFirst({
      where: messFilter,
      include: {
        meal_windows: {
          where: { is_active: true },
          orderBy: { start_time: 'asc' },
        },
        devices: true,
      },
    });

    if (!mess) {
      return res.status(200).json({
        mess: null,
        counts_by_meal: {},
        active_window: null,
        next_window: null,
        recent_feed: [],
        message: 'No mess assigned to this account',
      });
    }

    // Active & upcoming meal window resolver
    const mealStatus = await resolveMealWindow(mess.id);

    // Count today's meals grouped by meal type
    const [breakfastCount, lunchCount, snacksCount, dinnerCount] = await Promise.all([
      prisma.messAttendance.count({
        where: {
          mess_id: mess.id,
          meal_type: 'BREAKFAST',
          scanned_at: { gte: todayStart, lte: todayEnd },
        },
      }),
      prisma.messAttendance.count({
        where: {
          mess_id: mess.id,
          meal_type: 'LUNCH',
          scanned_at: { gte: todayStart, lte: todayEnd },
        },
      }),
      prisma.messAttendance.count({
        where: {
          mess_id: mess.id,
          meal_type: 'SNACKS',
          scanned_at: { gte: todayStart, lte: todayEnd },
        },
      }),
      prisma.messAttendance.count({
        where: {
          mess_id: mess.id,
          meal_type: 'DINNER',
          scanned_at: { gte: todayStart, lte: todayEnd },
        },
      }),
    ]);

    const totalMealsToday = breakfastCount + lunchCount + snacksCount + dinnerCount;

    // Recent 40 meal events for this mess
    const recentFeed = await prisma.messAttendance.findMany({
      where: { mess_id: mess.id },
      orderBy: { scanned_at: 'desc' },
      take: 40,
      include: {
        student: {
          include: {
            user: { select: { name: true } },
            hostel: { select: { code: true, name: true } },
            room: { select: { room_number: true } },
          },
        },
        meal_window: true,
      },
    });

    return res.status(200).json({
      mess: {
        id: mess.id,
        name: mess.name,
      },
      counts_by_meal: {
        BREAKFAST: breakfastCount,
        LUNCH: lunchCount,
        SNACKS: snacksCount,
        DINNER: dinnerCount,
        TOTAL: totalMealsToday,
      },
      active_window: mealStatus.active,
      next_window: mealStatus.next,
      all_windows: mealStatus.allWindows,
      current_time: mealStatus.currentTime,
      recent_feed: recentFeed,
    });
  } catch (error) {
    console.error('Error in getMessAdminDashboard:', error);
    return res.status(500).json({ error: 'Failed to load Mess Admin dashboard data' });
  }
}

/**
 * 8.7 Attendance History API
 * Searchable, filterable, and paginated attendance records across hostels and messes.
 */
export async function getAttendanceHistory(req, res) {
  try {
    const user = req.user;
    const {
      type = 'HOSTEL', // 'HOSTEL' | 'MESS'
      page = '1',
      limit = '20',
      search,
      hostel_id,
      mess_id,
      direction,
      meal_type,
      from_date,
      to_date,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    // Build date filter
    let dateFilter = {};
    if (from_date || to_date) {
      dateFilter.scanned_at = {};
      if (from_date) dateFilter.scanned_at.gte = new Date(from_date);
      if (to_date) dateFilter.scanned_at.lte = new Date(to_date);
    }

    if (type === 'HOSTEL') {
      let where = { ...dateFilter };

      // Role scoping
      if (user.role === 'WARDEN') {
        const wardenHostels = await prisma.hostel.findMany({
          where: { warden_id: user.id },
          select: { id: true },
        });
        where.hostel_id = { in: wardenHostels.map((h) => h.id) };
      }

      if (hostel_id) where.hostel_id = hostel_id;
      if (direction) where.direction = direction;

      if (search) {
        where.student = {
          OR: [
            { roll_number: { contains: search } },
            { user: { name: { contains: search } } },
          ],
        };
      }

      const [records, total] = await Promise.all([
        prisma.hostelAttendance.findMany({
          where,
          skip,
          take: limitNum,
          orderBy: { scanned_at: 'desc' },
          include: {
            student: {
              include: {
                user: { select: { name: true, email: true } },
                room: { select: { room_number: true } },
              },
            },
            gate: { select: { id: true, name: true } },
            hostel: { select: { id: true, code: true, name: true } },
          },
        }),
        prisma.hostelAttendance.count({ where }),
      ]);

      return res.status(200).json({
        type: 'HOSTEL',
        total,
        page: pageNum,
        limit: limitNum,
        total_pages: Math.ceil(total / limitNum),
        records,
      });
    } else {
      // MESS Attendance History
      let where = { ...dateFilter };

      // Role scoping
      if (user.role === 'MESS_ADMIN') {
        const adminMesses = await prisma.mess.findMany({
          where: { mess_admin_id: user.id },
          select: { id: true },
        });
        where.mess_id = { in: adminMesses.map((m) => m.id) };
      }

      if (mess_id) where.mess_id = mess_id;
      if (meal_type) where.meal_type = meal_type;

      if (search) {
        where.student = {
          OR: [
            { roll_number: { contains: search } },
            { user: { name: { contains: search } } },
          ],
        };
      }

      const [records, total] = await Promise.all([
        prisma.messAttendance.findMany({
          where,
          skip,
          take: limitNum,
          orderBy: { scanned_at: 'desc' },
          include: {
            student: {
              include: {
                user: { select: { name: true, email: true } },
                room: { select: { room_number: true } },
                hostel: { select: { code: true, name: true } },
              },
            },
            mess: { select: { id: true, name: true } },
            meal_window: true,
          },
        }),
        prisma.messAttendance.count({ where }),
      ]);

      return res.status(200).json({
        type: 'MESS',
        total,
        page: pageNum,
        limit: limitNum,
        total_pages: Math.ceil(total / limitNum),
        records,
      });
    }
  } catch (error) {
    console.error('Error in getAttendanceHistory:', error);
    return res.status(500).json({ error: 'Failed to fetch attendance history records' });
  }
}
