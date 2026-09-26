import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

/**
 * Deterministic pseudo-random number generator (Mulberry32).
 * Given a seed string, returns a function that produces consistent floats in [0, 1).
 */
export function createSeededRandom(seedStr) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

/**
 * Deterministic in-place Fisher-Yates array shuffle.
 */
export function seededShuffle(array, randomFn) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(randomFn() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Auto-creates renewal applications for all current residents of the specified hostel(s)
 * when a registration window opens.
 */
export async function createRenewalsForWindow(windowId, hostelId = null) {
  const window = await prisma.registrationWindow.findUnique({
    where: { id: windowId },
  });
  if (!window) throw new Error('Registration window not found');

  const whereHostel = hostelId
    ? { hostel_id: hostelId }
    : window.hostel_id
    ? { hostel_id: window.hostel_id }
    : {};

  // Current residents with assigned rooms
  const currentResidents = await prisma.student.findMany({
    where: {
      ...whereHostel,
      room_id: { not: null },
    },
    include: {
      room: true,
      hostel: true,
    },
  });

  const createdApplications = [];

  for (const resident of currentResidents) {
    // Check if an application already exists for this resident in this window
    const existing = await prisma.hostelApplication.findUnique({
      where: {
        window_id_student_id: {
          window_id: windowId,
          student_id: resident.id,
        },
      },
    });

    if (!existing) {
      // Recalculate year of study: continuing students advance by 1 year (cap at 5)
      const newYearOfStudy = Math.min(5, (resident.year || 1) + 1);

      const app = await prisma.hostelApplication.create({
        data: {
          window_id: windowId,
          student_id: resident.id,
          hostel_id: resident.hostel_id,
          year_of_study: newYearOfStudy,
          is_renewal: true,
          accessibility_needs: false,
          status: 'PENDING',
        },
      });
      createdApplications.push(app);
    }
  }

  return createdApplications;
}

/**
 * Helper to get available capacity per room in a hostel, taking into account
 * existing occupants + already proposed allocations in the current execution.
 */
async function getHostelRoomsWithOccupancy(hostelId) {
  const rooms = await prisma.room.findMany({
    where: {
      hostel_id: hostelId,
      status: 'ACTIVE',
    },
    include: {
      students: {
        select: { id: true },
      },
    },
    orderBy: [{ floor: 'asc' }, { room_number: 'asc' }],
  });

  return rooms.map((r) => ({
    id: r.id,
    hostel_id: r.hostel_id,
    floor: r.floor,
    room_number: r.room_number,
    capacity: r.capacity,
    is_accessible: r.is_accessible,
    current_occupants: r.students.length,
    proposed_occupants: 0,
    get remaining() {
      return this.capacity - (this.current_occupants + this.proposed_occupants);
    },
  }));
}

/**
 * Main Batch Allocation Engine.
 * Implements the 7-pass structural race-free room allocation algorithm:
 * 1. Accessibility pre-pass
 * 2. Renewals pass (continuing residents prioritized on target floor)
 * 3. Seeded lottery draw for new applicants
 * 4. Overflow cascade (target floor -> adjacent floor -> any floor in hostel)
 * 5. Whole-hostel redirect (to matching gender hostel)
 * 6. Campus-wide zero vacancy escalation
 * 7. Proposed state persistence (without modifying students.room_id)
 */
export async function runBatchAllocation({
  windowId,
  hostelId,
  lotterySeed = null,
  executedBy = null,
}) {
  const seed = lotterySeed || crypto.randomBytes(16).toString('hex');
  const rng = createSeededRandom(seed);

  const window = await prisma.registrationWindow.findUnique({
    where: { id: windowId },
  });
  if (!window) throw new Error('Registration window not found');

  const targetHostel = await prisma.hostel.findUnique({
    where: { id: hostelId },
  });
  if (!targetHostel) throw new Error('Target hostel not found');

  // Load all floor-to-year mappings for this hostel
  const floorMappings = await prisma.floorYearMapping.findMany({
    where: { hostel_id: hostelId },
  });

  // Map year of study -> target floor
  const yearToFloor = new Map();
  floorMappings.forEach((m) => {
    yearToFloor.set(m.year_of_study, m.floor);
  });

  // Load all pending applications for this window & target hostel
  const applications = await prisma.hostelApplication.findMany({
    where: {
      window_id: windowId,
      hostel_id: hostelId,
      status: 'PENDING',
    },
    include: {
      student: {
        include: { user: true },
      },
    },
  });

  if (applications.length === 0) {
    // Return early if no applications
    const batch = await prisma.allocationBatch.create({
      data: {
        window_id: windowId,
        hostel_id: hostelId,
        lottery_seed: seed,
        total_applicants: 0,
        allocated_count: 0,
        overflow_count: 0,
        redirect_count: 0,
        escalated_count: 0,
        status: 'COMPLETED',
        executed_by: executedBy,
      },
    });
    return { batch, allocations: [] };
  }

  // Load rooms for target hostel
  const targetRooms = await getHostelRoomsWithOccupancy(hostelId);

  // Group rooms by floor
  const roomsByFloor = new Map();
  targetRooms.forEach((r) => {
    if (!roomsByFloor.has(r.floor)) {
      roomsByFloor.set(r.floor, []);
    }
    roomsByFloor.get(r.floor).push(r);
  });

  const allFloors = Array.from(roomsByFloor.keys()).sort((a, b) => a - b);

  // Helper to find a room on a given floor
  function findRoomOnFloor(floor, accessibleOnly = false) {
    const floorRooms = roomsByFloor.get(floor) || [];
    for (const r of floorRooms) {
      if (accessibleOnly && !r.is_accessible && floor !== 0) continue;
      if (r.remaining > 0) {
        r.proposed_occupants += 1;
        return r;
      }
    }
    return null;
  }

  // Helper to find room across adjacent floors, then any floor in hostel
  function findCascadeRoom(targetFloor) {
    // 1. Target floor
    const direct = findRoomOnFloor(targetFloor);
    if (direct) return { room: direct, step: 'TARGET_FLOOR' };

    // 2. Nearest adjacent floors
    const sortedByProximity = [...allFloors]
      .filter((f) => f !== targetFloor)
      .sort((a, b) => Math.abs(a - targetFloor) - Math.abs(b - targetFloor));

    if (sortedByProximity.length > 0) {
      const nearestDistance = Math.abs(sortedByProximity[0] - targetFloor);
      // Try strictly adjacent floors (|diff| === 1 or closest)
      for (const f of sortedByProximity) {
        if (Math.abs(f - targetFloor) === nearestDistance) {
          const adjRoom = findRoomOnFloor(f);
          if (adjRoom) return { room: adjRoom, step: 'ADJACENT_FLOOR' };
        }
      }
    }

    // 3. Any remaining floor in the hostel
    for (const f of sortedByProximity) {
      const anyRoom = findRoomOnFloor(f);
      if (anyRoom) return { room: anyRoom, step: 'ANY_FLOOR' };
    }

    return null;
  }

  const plannedAllocations = [];
  const escalatedApps = [];
  const redirectedApps = [];

  // -------------------------------------------------------------
  // PASS 1: Accessibility Pre-Pass (Exempt from lottery)
  // -------------------------------------------------------------
  const accessibilityApps = applications.filter((a) => a.accessibility_needs);
  for (const app of accessibilityApps) {
    // Look for special accessible rooms or ground floor (floor 0)
    let room = findRoomOnFloor(0, true) || findRoomOnFloor(0, false);
    let step = 'ACCESSIBILITY_PREPASS';

    if (!room) {
      // If floor 0 full, try any floor
      const cascade = findCascadeRoom(0);
      if (cascade) {
        room = cascade.room;
        step = cascade.step;
      }
    }

    if (room) {
      plannedAllocations.push({
        application: app,
        room,
        hostelId,
        assignedFloor: room.floor,
        cascadeStep: step,
        isClean: true,
        flagReasons: [],
      });
    } else {
      // Must be redirected or escalated
      escalatedApps.push(app);
    }
  }

  const assignedAppIds = new Set(plannedAllocations.map((p) => p.application.id));

  // -------------------------------------------------------------
  // PASS 2: Renewals Pass (Continuing Residents Priority)
  // -------------------------------------------------------------
  const renewalApps = applications.filter(
    (a) => a.is_renewal && !assignedAppIds.has(a.id)
  );

  for (const app of renewalApps) {
    const targetFloor = yearToFloor.get(app.year_of_study) ?? 0;
    const cascade = findCascadeRoom(targetFloor);

    if (cascade) {
      plannedAllocations.push({
        application: app,
        room: cascade.room,
        hostelId,
        assignedFloor: cascade.room.floor,
        cascadeStep: cascade.step,
        isClean: true,
        flagReasons: [],
      });
      assignedAppIds.add(app.id);
    } else {
      // Target hostel full for continuing resident -> redirect or escalate
      redirectedApps.push(app);
    }
  }

  // -------------------------------------------------------------
  // PASS 3: New-Admit Seeded Lottery Pass
  // -------------------------------------------------------------
  const newApps = applications.filter(
    (a) => !a.is_renewal && !assignedAppIds.has(a.id)
  );

  // Deterministically shuffle new applicants using the reproducible lottery seed
  const lotteryOrderedNewApps = seededShuffle(newApps, rng);

  for (const app of lotteryOrderedNewApps) {
    const targetFloor = yearToFloor.get(app.year_of_study) ?? 0;
    const cascade = findCascadeRoom(targetFloor);

    if (cascade) {
      plannedAllocations.push({
        application: app,
        room: cascade.room,
        hostelId,
        assignedFloor: cascade.room.floor,
        cascadeStep: cascade.step,
        isClean: true,
        flagReasons: [],
      });
      assignedAppIds.add(app.id);
    } else {
      // Target hostel full for this new admit
      redirectedApps.push(app);
    }
  }

  // -------------------------------------------------------------
  // PASS 4 & 5: Whole-Hostel-Full Redirect (Matching Gender)
  // -------------------------------------------------------------
  // Find other hostels with matching gender
  const otherMatchingHostels = await prisma.hostel.findMany({
    where: {
      type: targetHostel.type,
      id: { not: hostelId },
    },
    orderBy: { code: 'asc' },
  });

  for (const app of redirectedApps) {
    let redirectedAllocation = null;

    // Check each alternative hostel for available rooms
    for (const altHostel of otherMatchingHostels) {
      const altRooms = await getHostelRoomsWithOccupancy(altHostel.id);
      const altFloorMappings = await prisma.floorYearMapping.findMany({
        where: { hostel_id: altHostel.id },
      });
      const altYearToFloor = new Map();
      altFloorMappings.forEach((m) => altYearToFloor.set(m.year_of_study, m.floor));
      const targetAltFloor = altYearToFloor.get(app.year_of_study) ?? 0;

      // Find first available room in alternative hostel
      const availableRoom = altRooms.find((r) => r.remaining > 0);
      if (availableRoom) {
        availableRoom.proposed_occupants += 1;
        redirectedAllocation = {
          application: app,
          room: availableRoom,
          hostelId: altHostel.id,
          assignedFloor: availableRoom.floor,
          cascadeStep: 'REDIRECTED_HOSTEL',
          isClean: false, // Redirects require individual Caretaker review
          flagReasons: ['REDIRECT_CASE'],
          redirectReason: `Target hostel ${targetHostel.name} reached 100% capacity; redirected to ${altHostel.name} (${altHostel.code}) with matching gender vacancy`,
          redirectFromHostelId: hostelId,
        };
        break;
      }
    }

    if (redirectedAllocation) {
      plannedAllocations.push(redirectedAllocation);
      assignedAppIds.add(app.id);
    } else {
      // -------------------------------------------------------------
      // PASS 6: Zero Campus-Wide Vacancy -> ESCALATED
      // -------------------------------------------------------------
      escalatedApps.push(app);
    }
  }

  // -------------------------------------------------------------
  // PASS 7: Database Persistence (Proposed State)
  // -------------------------------------------------------------
  let overflowCount = 0;
  let redirectCount = 0;

  plannedAllocations.forEach((p) => {
    if (p.cascadeStep === 'ADJACENT_FLOOR' || p.cascadeStep === 'ANY_FLOOR') {
      overflowCount += 1;
    }
    if (p.cascadeStep === 'REDIRECTED_HOSTEL') {
      redirectCount += 1;
    }
  });

  const result = await prisma.$transaction(async (tx) => {
    // 1. Create Allocation Batch record
    const batch = await tx.allocationBatch.create({
      data: {
        window_id: windowId,
        hostel_id: hostelId,
        lottery_seed: seed,
        total_applicants: applications.length,
        allocated_count: plannedAllocations.length,
        overflow_count: overflowCount,
        redirect_count: redirectCount,
        escalated_count: escalatedApps.length,
        status: 'COMPLETED',
        executed_by: executedBy,
      },
    });

    // 2. Insert all PROPOSED RoomAllocation rows
    const createdAllocations = [];
    for (const item of plannedAllocations) {
      // If redirected, update application with redirect metadata
      if (item.redirectFromHostelId) {
        await tx.hostelApplication.update({
          where: { id: item.application.id },
          data: {
            redirect_from_hostel_id: item.redirectFromHostelId,
            redirect_reason: item.redirectReason,
            status: 'FLAGGED',
            flag_reason: item.redirectReason,
          },
        });
      } else {
        await tx.hostelApplication.update({
          where: { id: item.application.id },
          data: { status: 'ALLOCATED' },
        });
      }

      const alloc = await tx.roomAllocation.create({
        data: {
          batch_id: batch.id,
          application_id: item.application.id,
          student_id: item.application.student_id,
          room_id: item.room.id,
          hostel_id: item.hostelId,
          assigned_floor: item.assignedFloor,
          cascade_step: item.cascadeStep,
          status: 'PROPOSED',
          is_clean: item.isClean,
          flag_reasons: item.flagReasons.length > 0 ? item.flagReasons : null,
        },
      });
      createdAllocations.push(alloc);
    }

    // 3. Mark escalated applications (zero vacancy campus-wide)
    for (const escApp of escalatedApps) {
      await tx.hostelApplication.update({
        where: { id: escApp.id },
        data: {
          status: 'ESCALATED',
          flag_reason: `Zero vacancy campus-wide for ${targetHostel.type === 'GIRLS' ? 'girls' : 'boys'} hostels. Awaiting Super Admin manual placement.`,
        },
      });
    }

    return { batch, allocations: createdAllocations };
  });

  return result;
}

/**
 * Confirm a single room allocation.
 * Sets allocation status to CONFIRMED and atomically writes students.room_id.
 */
export async function confirmAllocation(allocationId, confirmedBy, reviewNotes = null) {
  return prisma.$transaction(async (tx) => {
    const allocation = await tx.roomAllocation.findUnique({
      where: { id: allocationId },
      include: { application: true },
    });
    if (!allocation) throw new Error('Allocation record not found');
    if (allocation.status === 'CONFIRMED') return allocation;

    const updatedAllocation = await tx.roomAllocation.update({
      where: { id: allocationId },
      data: {
        status: 'CONFIRMED',
        confirmed_by: confirmedBy,
        confirmed_at: new Date(),
        review_notes: reviewNotes || allocation.review_notes,
      },
    });

    // Atomically set student's room_id and hostel_id
    await tx.student.update({
      where: { id: allocation.student_id },
      data: {
        room_id: allocation.room_id,
        hostel_id: allocation.hostel_id,
      },
    });

    return updatedAllocation;
  });
}

/**
 * Bulk-confirm all clean proposed allocations for a given batch or hostel.
 */
export async function bulkConfirmCleanAllocations(batchId, confirmedBy) {
  const cleanAllocations = await prisma.roomAllocation.findMany({
    where: {
      batch_id: batchId,
      status: 'PROPOSED',
      is_clean: true,
    },
  });

  return prisma.$transaction(async (tx) => {
    const now = new Date();
    let confirmedCount = 0;

    for (const alloc of cleanAllocations) {
      await tx.roomAllocation.update({
        where: { id: alloc.id },
        data: {
          status: 'CONFIRMED',
          confirmed_by: confirmedBy,
          confirmed_at: now,
        },
      });

      await tx.student.update({
        where: { id: alloc.student_id },
        data: {
          room_id: alloc.room_id,
          hostel_id: alloc.hostel_id,
        },
      });

      confirmedCount += 1;
    }

    return { confirmedCount };
  });
}

/**
 * Request a room swap between Student A and Student B / target room.
 */
export async function createRoomSwapRequest({
  senderStudentId,
  targetStudentId,
  note = null,
}) {
  const [studentA, studentB] = await Promise.all([
    prisma.student.findUnique({
      where: { id: senderStudentId },
      include: { room: true },
    }),
    prisma.student.findUnique({
      where: { id: targetStudentId },
      include: { room: true },
    }),
  ]);

  if (!studentA || !studentA.room_id || !studentA.room) {
    throw new Error('Sender student does not have an active confirmed room');
  }
  if (!studentB || !studentB.room_id || !studentB.room) {
    throw new Error('Target student does not have an active confirmed room');
  }
  if (studentA.hostel_id !== studentB.hostel_id) {
    throw new Error('Room swaps can only occur within the same hostel');
  }

  // Check floor-year mapping tiers to determine if swap crosses tiers
  const [mappingA, mappingB] = await Promise.all([
    prisma.floorYearMapping.findFirst({
      where: {
        hostel_id: studentA.hostel_id,
        floor: studentA.room.floor,
      },
    }),
    prisma.floorYearMapping.findFirst({
      where: {
        hostel_id: studentB.hostel_id,
        floor: studentB.room.floor,
      },
    }),
  ]);

  // If different floors or mapped to different years of study, it is a cross-tier swap
  const isSameFloor = studentA.room.floor === studentB.room.floor;
  const isSameYearTier =
    mappingA && mappingB
      ? mappingA.year_of_study === mappingB.year_of_study
      : isSameFloor;

  const isCrossTier = !isSameFloor || !isSameYearTier;

  const swapRequest = await prisma.roomSwapRequest.create({
    data: {
      sender_student_id: studentA.id,
      sender_room_id: studentA.room_id,
      target_student_id: studentB.id,
      target_room_id: studentB.room_id,
      status: 'PENDING_PEER_ACCEPTANCE',
      is_cross_tier: isCrossTier,
      decision_note: note,
    },
    include: {
      sender_student: { include: { user: true, room: true } },
      target_student: { include: { user: true, room: true } },
    },
  });

  return swapRequest;
}

/**
 * Peer acceptance by Student B.
 * If cross-tier, automatically transitions to ESCALATED_TO_WARDEN.
 * If same-tier, transitions to PEER_ACCEPTED (Caretaker can approve directly).
 */
export async function acceptSwapPeer(swapId, studentId) {
  const swap = await prisma.roomSwapRequest.findUnique({
    where: { id: swapId },
  });
  if (!swap) throw new Error('Swap request not found');
  if (swap.target_student_id !== studentId) {
    throw new Error('Only the recipient peer student can accept this swap request');
  }
  if (swap.status !== 'PENDING_PEER_ACCEPTANCE') {
    throw new Error(`Cannot accept swap in status ${swap.status}`);
  }

  const nextStatus = swap.is_cross_tier ? 'ESCALATED_TO_WARDEN' : 'PEER_ACCEPTED';

  return prisma.roomSwapRequest.update({
    where: { id: swapId },
    data: {
      status: nextStatus,
      peer_accepted_at: new Date(),
    },
    include: {
      sender_student: { include: { user: true, room: true } },
      target_student: { include: { user: true, room: true } },
    },
  });
}

/**
 * Decide a room swap (Approve or Reject).
 * - Same-tier: Caretaker or Warden can approve.
 * - Cross-tier: strictly Warden / Vice Warden authority; Caretaker attempt throws 403.
 * - On approval: atomically swaps both students' room_id in a single transaction.
 */
export async function decideRoomSwap({
  swapId,
  userId,
  userRole,
  action, // 'APPROVE' | 'REJECT'
  decisionNote = null,
}) {
  const swap = await prisma.roomSwapRequest.findUnique({
    where: { id: swapId },
  });
  if (!swap) throw new Error('Swap request not found');

  if (
    swap.status !== 'PEER_ACCEPTED' &&
    swap.status !== 'ESCALATED_TO_WARDEN'
  ) {
    throw new Error(`Swap request is not ready for decision (status: ${swap.status})`);
  }

  const isWarden = userRole === 'WARDEN' || userRole === 'VICE_WARDEN' || userRole === 'SUPER_ADMIN';

  // Cross-tier guard: only Warden / Vice Warden / Admin can approve
  if (swap.is_cross_tier && !isWarden) {
    const error = new Error('Cross-tier room swap crosses floor-year policy and requires Warden approval');
    error.statusCode = 403;
    error.code = 'CROSS_TIER_SWAP_REQUIRES_WARDEN';
    throw error;
  }

  if (action === 'REJECT') {
    return prisma.roomSwapRequest.update({
      where: { id: swapId },
      data: {
        status: 'REJECTED',
        decided_by: userId,
        decided_at: new Date(),
        decision_note: decisionNote,
      },
    });
  }

  // Atomically perform the room swap
  return prisma.$transaction(async (tx) => {
    // 1. Swap room_id on Student A and Student B
    await tx.student.update({
      where: { id: swap.sender_student_id },
      data: { room_id: swap.target_room_id },
    });

    await tx.student.update({
      where: { id: swap.target_student_id },
      data: { room_id: swap.sender_room_id },
    });

    // 2. Mark swap request APPROVED
    const updatedSwap = await tx.roomSwapRequest.update({
      where: { id: swapId },
      data: {
        status: 'APPROVED',
        decided_by: userId,
        decided_at: new Date(),
        decision_note: decisionNote,
      },
      include: {
        sender_student: { include: { user: true, room: true } },
        target_student: { include: { user: true, room: true } },
      },
    });

    return updatedSwap;
  });
}
