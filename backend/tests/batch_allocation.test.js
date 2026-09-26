import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { app } from '../src/index.js';
import prisma from '../src/prisma.js';
import { generateAccessToken } from '../src/utils/token.js';
import { createSeededRandom, seededShuffle } from '../src/services/allocationService.js';

describe('Phase 14: Batch Room Allocation & Mutual Room Swapping', () => {
  let superAdminUser;
  let superAdminToken;

  let caretakerUser;
  let caretakerToken;

  let wardenUser;
  let wardenToken;

  let testHostelA; // Primary Boys Hostel
  let testHostelB; // Secondary Boys Hostel (for redirects)
  let testHostelGirls; // Girls Hostel (for gender isolation verification)

  let roomA_F1; // Floor 1, capacity 1
  let roomA_F2; // Floor 2, capacity 1
  let roomA_F3; // Floor 3, capacity 1
  let roomB_F1; // Floor 1, capacity 1

  let windowA;
  let testPasswordHash;

  const testSuffix = Date.now().toString().slice(-6);

  before(async () => {
    const salt = await bcrypt.genSalt(10);
    testPasswordHash = await bcrypt.hash('password123', salt);

    // 1. Fetch Super Admin
    superAdminUser = await prisma.user.findUnique({ where: { email: 'admin@hostel360.com' } });
    if (!superAdminUser) {
      superAdminUser = await prisma.user.create({
        data: {
          name: 'Super Admin Test',
          email: `admin.batch.${testSuffix}@hostel360.com`,
          password_hash: testPasswordHash,
          role: 'SUPER_ADMIN',
        },
      });
    }
    superAdminToken = generateAccessToken(superAdminUser);

    // 2. Create dedicated Test Hostels
    testHostelA = await prisma.hostel.create({
      data: {
        name: `Batch Test Hostel A ${testSuffix}`,
        code: `BA_${testSuffix}`,
        type: 'BOYS',
        location: 'North Campus Block A',
        total_capacity: 3,
      },
    });

    testHostelB = await prisma.hostel.create({
      data: {
        name: `Batch Test Hostel B ${testSuffix}`,
        code: `BB_${testSuffix}`,
        type: 'BOYS',
        location: 'North Campus Block B',
        total_capacity: 1,
      },
    });

    testHostelGirls = await prisma.hostel.create({
      data: {
        name: `Batch Test Hostel Girls ${testSuffix}`,
        code: `BG_${testSuffix}`,
        type: 'GIRLS',
        location: 'South Campus Girls Wing',
        total_capacity: 2,
      },
    });

    // 3. Create rooms with specific capacities for strict deterministic testing
    roomA_F1 = await prisma.room.create({
      data: {
        hostel_id: testHostelA.id,
        room_number: `A-101`,
        floor: 1,
        capacity: 1,
        status: 'ACTIVE',
        is_accessible: true, // ground/accessible room
      },
    });

    roomA_F2 = await prisma.room.create({
      data: {
        hostel_id: testHostelA.id,
        room_number: `A-201`,
        floor: 2,
        capacity: 1,
        status: 'ACTIVE',
      },
    });

    roomA_F3 = await prisma.room.create({
      data: {
        hostel_id: testHostelA.id,
        room_number: `A-301`,
        floor: 3,
        capacity: 1,
        status: 'ACTIVE',
      },
    });

    roomB_F1 = await prisma.room.create({
      data: {
        hostel_id: testHostelB.id,
        room_number: `B-101`,
        floor: 1,
        capacity: 1,
        status: 'ACTIVE',
      },
    });

    // 4. Floor-Year Mapping for Hostel A:
    // Floor 1 -> Year 1
    // Floor 2 -> Year 2
    // Floor 3 -> Year 3
    await prisma.floorYearMapping.createMany({
      data: [
        { hostel_id: testHostelA.id, floor: 1, year_of_study: 1 },
        { hostel_id: testHostelA.id, floor: 2, year_of_study: 2 },
        { hostel_id: testHostelA.id, floor: 3, year_of_study: 3 },
      ],
    });

    // 5. Create Caretaker and Warden assigned to Hostel A
    caretakerUser = await prisma.user.create({
      data: {
        name: `Caretaker BA ${testSuffix}`,
        email: `caretaker.ba.${testSuffix}@hostel360.com`,
        password_hash: testPasswordHash,
        role: 'CARETAKER',
        staff_hostel_assignments: {
          create: [{ hostel_id: testHostelA.id, role: 'CARETAKER' }],
        },
      },
      include: { staff_hostel_assignments: true },
    });
    caretakerToken = generateAccessToken(caretakerUser);

    wardenUser = await prisma.user.create({
      data: {
        name: `Warden BA ${testSuffix}`,
        email: `warden.ba.${testSuffix}@hostel360.com`,
        password_hash: testPasswordHash,
        role: 'WARDEN',
        staff_hostel_assignments: {
          create: [{ hostel_id: testHostelA.id, role: 'WARDEN' }],
        },
      },
      include: { staff_hostel_assignments: true },
    });
    wardenToken = generateAccessToken(wardenUser);

    // 6. Create Registration Window
    const now = new Date();
    const openFrom = new Date(now.getTime() - 3600 * 1000);
    const openTo = new Date(now.getTime() + 86400 * 1000 * 7);

    windowA = await prisma.registrationWindow.create({
      data: {
        hostel_id: testHostelA.id,
        academic_year: '2026-2027',
        open_from: openFrom,
        open_to: openTo,
        status: 'OPEN',
      },
    });
  });

  after(async () => {
    // Cleanup created test records
    try {
      const hostelIds = [testHostelA?.id, testHostelB?.id, testHostelGirls?.id].filter(Boolean);
      if (hostelIds.length > 0) {
        await prisma.roomSwapRequest.deleteMany({
          where: {
            OR: [
              { sender_student: { hostel_id: { in: hostelIds } } },
              { target_student: { hostel_id: { in: hostelIds } } },
            ],
          },
        });
        await prisma.roomAllocation.deleteMany({
          where: { hostel_id: { in: hostelIds } },
        });
        await prisma.hostelApplication.deleteMany({
          where: { hostel_id: { in: hostelIds } },
        });
        await prisma.allocationBatch.deleteMany({
          where: { hostel_id: { in: hostelIds } },
        });
        if (windowA?.id) {
          await prisma.registrationWindow.deleteMany({
            where: { id: windowA.id },
          });
        }
        await prisma.floorYearMapping.deleteMany({
          where: { hostel_id: { in: hostelIds } },
        });
        await prisma.student.deleteMany({
          where: { hostel_id: { in: hostelIds } },
        });
        await prisma.room.deleteMany({
          where: { hostel_id: { in: hostelIds } },
        });
        await prisma.staffHostelAssignment.deleteMany({
          where: { hostel_id: { in: hostelIds } },
        });
        const userIds = [caretakerUser?.id, wardenUser?.id].filter(Boolean);
        if (userIds.length > 0) {
          await prisma.user.deleteMany({
            where: { id: { in: userIds } },
          });
        }
        await prisma.hostel.deleteMany({
          where: { id: { in: hostelIds } },
        });
      }
    } catch (cleanupErr) {
      console.warn('Test cleanup warning:', cleanupErr.message);
    }
  });

  async function createTestStudent({ name, rollNumber, gender = 'MALE', year = 1, hostelId, roomId = null }) {
    const user = await prisma.user.create({
      data: {
        name,
        email: `${rollNumber.toLowerCase()}.${Date.now()}@student.test`,
        password_hash: testPasswordHash,
        role: 'STUDENT',
      },
    });
    const student = await prisma.student.create({
      data: {
        user_id: user.id,
        roll_number: rollNumber,
        gender,
        year,
        hostel_id: hostelId,
        room_id: roomId,
      },
      include: { user: true, room: true },
    });
    const token = generateAccessToken(user);
    return { user, student, token };
  }

  // --------------------------------------------------------------------------
  // TEST 1: Mulberry32 Seed Determinism & Reproducibility
  // --------------------------------------------------------------------------
  test('PRNG & Seed Reproducibility: identical seed against same applicant array produces 100% identical ordering', () => {
    const seed = 'lottery-audit-seed-2026';
    const applicants = ['App-1', 'App-2', 'App-3', 'App-4', 'App-5', 'App-6', 'App-7'];

    const rng1 = createSeededRandom(seed);
    const shuffled1 = seededShuffle(applicants, rng1);

    const rng2 = createSeededRandom(seed);
    const shuffled2 = seededShuffle(applicants, rng2);

    assert.deepStrictEqual(shuffled1, shuffled2, 'Mulberry32 shuffle must be 100% deterministic given same seed');

    // Different seed produces different ordering
    const rng3 = createSeededRandom('different-seed-999');
    const shuffled3 = seededShuffle(applicants, rng3);
    assert.notDeepStrictEqual(shuffled1, shuffled3, 'Different seeds should produce different orderings');
  });

  // --------------------------------------------------------------------------
  // TEST 2: Two Applications in Same Second — Batch Eliminates Race Condition
  // --------------------------------------------------------------------------
  test('Checklist 1: Two applications submitted in same second for last seat — decided by seed, not timestamp', async () => {
    const student1 = await createTestStudent({
      name: 'Simultaneous Student 1',
      rollNumber: `SIM1_${testSuffix}`,
      year: 1,
      hostelId: testHostelA.id,
    });
    const student2 = await createTestStudent({
      name: 'Simultaneous Student 2',
      rollNumber: `SIM2_${testSuffix}`,
      year: 1,
      hostelId: testHostelA.id,
    });

    // Both submit application for Hostel A, Floor 1 (Year 1)
    const res1 = await request(app)
      .post('/api/allocations/applications')
      .set('Authorization', `Bearer ${student1.token}`)
      .send({
        window_id: windowA.id,
        hostel_id: testHostelA.id,
        year_of_study: 1,
      });
    assert.strictEqual(res1.status, 201);

    const res2 = await request(app)
      .post('/api/allocations/applications')
      .set('Authorization', `Bearer ${student2.token}`)
      .send({
        window_id: windowA.id,
        hostel_id: testHostelA.id,
        year_of_study: 1,
      });
    assert.strictEqual(res2.status, 201);

    // Verify both applications are PENDING with no room_id chosen
    const app1 = res1.body.application;
    const app2 = res2.body.application;
    assert.strictEqual(app1.status, 'PENDING');
    assert.strictEqual(app2.status, 'PENDING');

    // Run batch with fixed seed 'seed_simultaneous_test'
    const batchRes = await request(app)
      .post('/api/allocations/batches/run')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        window_id: windowA.id,
        hostel_id: testHostelA.id,
        lottery_seed: 'seed_simultaneous_test',
      });
    assert.strictEqual(batchRes.status, 201);

    // Fetch batch details
    const detailsRes = await request(app)
      .get(`/api/allocations/batches/${batchRes.body.batch.id}`)
      .set('Authorization', `Bearer ${superAdminToken}`);
    assert.strictEqual(detailsRes.status, 200);

    const allocations = detailsRes.body.batch.allocations;
    assert.strictEqual(allocations.length, 2);

    // One got Floor 1 (TARGET_FLOOR), the other overflowed to Floor 2 (ADJACENT_FLOOR)
    const targetFloorAlloc = allocations.find((a) => a.cascade_step === 'TARGET_FLOOR');
    const adjacentFloorAlloc = allocations.find((a) => a.cascade_step === 'ADJACENT_FLOOR');

    assert.ok(targetFloorAlloc, 'One applicant must get target floor');
    assert.ok(adjacentFloorAlloc, 'Second applicant must overflow to adjacent floor');
    assert.strictEqual(targetFloorAlloc.assigned_floor, 1);
    assert.strictEqual(adjacentFloorAlloc.assigned_floor, 2);

    // Verify all allocations start in PROPOSED status and student.room_id is NOT yet set
    for (const alloc of allocations) {
      assert.strictEqual(alloc.status, 'PROPOSED');
      const stud = await prisma.student.findUnique({ where: { id: alloc.student_id } });
      assert.strictEqual(stud.room_id, null, 'students.room_id must NOT be modified in PROPOSED status');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 3: Renewal Priority Over New Admit
  // --------------------------------------------------------------------------
  test('Checklist 2: Continuing resident is placed BEFORE new admit regardless of lottery draw', async () => {
    // Clean up previous batch allocations in Hostel A for isolated testing
    await prisma.roomAllocation.deleteMany({ where: { hostel_id: testHostelA.id } });
    await prisma.hostelApplication.deleteMany({ where: { hostel_id: testHostelA.id } });

    // 1. Existing resident who has roomA_F1 currently, progressing to Year 2
    const resident = await createTestStudent({
      name: 'Continuing Resident',
      rollNumber: `RES_${testSuffix}`,
      year: 1, // Will advance to year 2
      hostelId: testHostelA.id,
      roomId: roomA_F1.id,
    });

    // 2. New applicant for Year 2
    const newAdmit = await createTestStudent({
      name: 'New Admit Year 2',
      rollNumber: `NEW_${testSuffix}`,
      year: 2,
      hostelId: testHostelA.id,
    });

    // Renewal application (is_renewal = true)
    await prisma.hostelApplication.create({
      data: {
        window_id: windowA.id,
        student_id: resident.student.id,
        hostel_id: testHostelA.id,
        year_of_study: 2,
        is_renewal: true,
        status: 'PENDING',
      },
    });

    // New Admit application (is_renewal = false)
    await prisma.hostelApplication.create({
      data: {
        window_id: windowA.id,
        student_id: newAdmit.student.id,
        hostel_id: testHostelA.id,
        year_of_study: 2,
        is_renewal: false,
        status: 'PENDING',
      },
    });

    // Floor 2 has only 1 seat (roomA_F2 capacity 1).
    // Run batch: resident MUST get roomA_F2 (Floor 2, TARGET_FLOOR)
    const batchRes = await request(app)
      .post('/api/allocations/batches/run')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        window_id: windowA.id,
        hostel_id: testHostelA.id,
        lottery_seed: 'seed_renewal_test',
      });
    assert.strictEqual(batchRes.status, 201);

    const residentAlloc = await prisma.roomAllocation.findFirst({
      where: { student_id: resident.student.id },
    });
    const newAdmitAlloc = await prisma.roomAllocation.findFirst({
      where: { student_id: newAdmit.student.id },
    });

    assert.ok(residentAlloc, 'Resident must be allocated');
    assert.strictEqual(residentAlloc.assigned_floor, 2, 'Resident must get their target floor (floor 2)');
    assert.strictEqual(residentAlloc.room_id, roomA_F2.id);

    // New admit had to cascade because Floor 2 was taken by resident
    assert.ok(newAdmitAlloc, 'New admit must be allocated');
    assert.notStrictEqual(newAdmitAlloc.room_id, roomA_F2.id, 'New admit cannot take floor 2 seat over continuing resident');
  });

  // --------------------------------------------------------------------------
  // TEST 4: Floor Overflow Cascade Order (Target -> Adjacent -> Any Floor)
  // --------------------------------------------------------------------------
  test('Checklist 3: Floor overflow cascades to adjacent floor, then any floor in hostel', async () => {
    await prisma.roomAllocation.deleteMany({ where: { hostel_id: testHostelA.id } });
    await prisma.hostelApplication.deleteMany({ where: { hostel_id: testHostelA.id } });
    await prisma.student.updateMany({
      where: { hostel_id: testHostelA.id },
      data: { room_id: null },
    });

    // Fill Floor 1 target floor with 3 Year 1 applicants.
    // Hostel A has:
    // Floor 1: roomA_F1 (cap 1)
    // Floor 2: roomA_F2 (cap 1)
    // Floor 3: roomA_F3 (cap 1)
    const s1 = await createTestStudent({ name: 'F1 App 1', rollNumber: `F1_A1_${testSuffix}`, hostelId: testHostelA.id });
    const s2 = await createTestStudent({ name: 'F1 App 2', rollNumber: `F1_A2_${testSuffix}`, hostelId: testHostelA.id });
    const s3 = await createTestStudent({ name: 'F1 App 3', rollNumber: `F1_A3_${testSuffix}`, hostelId: testHostelA.id });

    for (const s of [s1, s2, s3]) {
      await prisma.hostelApplication.create({
        data: {
          window_id: windowA.id,
          student_id: s.student.id,
          hostel_id: testHostelA.id,
          year_of_study: 1,
          is_renewal: false,
          status: 'PENDING',
        },
      });
    }

    const batchRes = await request(app)
      .post('/api/allocations/batches/run')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        window_id: windowA.id,
        hostel_id: testHostelA.id,
        lottery_seed: 'seed_cascade_test',
      });
    assert.strictEqual(batchRes.status, 201);

    const allocs = await prisma.roomAllocation.findMany({
      where: { batch_id: batchRes.body.batch.id },
      orderBy: { assigned_floor: 'asc' },
    });

    assert.strictEqual(allocs.length, 3);
    const steps = allocs.map((a) => a.cascade_step);
    assert.ok(steps.includes('TARGET_FLOOR'), 'One should get TARGET_FLOOR (Floor 1)');
    assert.ok(steps.includes('ADJACENT_FLOOR'), 'One should get ADJACENT_FLOOR (Floor 2)');
    assert.ok(steps.includes('ANY_FLOOR'), 'One should get ANY_FLOOR (Floor 3)');
  });

  // --------------------------------------------------------------------------
  // TEST 5: Whole-Hostel-Full Redirect (Matching Gender Only)
  // --------------------------------------------------------------------------
  test('Checklist 4: When target hostel is 100% full, redirect to matching gender hostel with clear reason', async () => {
    await prisma.roomAllocation.deleteMany({ where: { hostel_id: { in: [testHostelA.id, testHostelB.id] } } });
    await prisma.hostelApplication.deleteMany({ where: { hostel_id: { in: [testHostelA.id, testHostelB.id] } } });
    await prisma.student.updateMany({
      where: { hostel_id: { in: [testHostelA.id, testHostelB.id] } },
      data: { room_id: null },
    });

    // Hostel A has total capacity 3 (F1=1, F2=1, F3=1).
    // Hostel B has total capacity 1 (F1=1). Both are BOYS hostels.
    // If we submit 4 applicants to Hostel A, 3 should fill Hostel A, and the 4th should redirect to Hostel B!
    const students = [];
    for (let i = 1; i <= 4; i++) {
      const s = await createTestStudent({
        name: `Overflow Student ${i}`,
        rollNumber: `OVF_${i}_${testSuffix}`,
        hostelId: testHostelA.id,
      });
      students.push(s);
      await prisma.hostelApplication.create({
        data: {
          window_id: windowA.id,
          student_id: s.student.id,
          hostel_id: testHostelA.id,
          year_of_study: 1,
          is_renewal: false,
          status: 'PENDING',
        },
      });
    }

    const batchRes = await request(app)
      .post('/api/allocations/batches/run')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        window_id: windowA.id,
        hostel_id: testHostelA.id,
        lottery_seed: 'seed_redirect_test',
      });
    assert.strictEqual(batchRes.status, 201);

    const redirectedAlloc = await prisma.roomAllocation.findFirst({
      where: {
        batch_id: batchRes.body.batch.id,
        cascade_step: 'REDIRECTED_HOSTEL',
      },
      include: { application: true },
    });

    assert.ok(redirectedAlloc, 'Must have one redirected allocation');
    assert.strictEqual(redirectedAlloc.hostel_id, testHostelB.id, 'Must be redirected to another BOYS hostel (Hostel B)');
    assert.strictEqual(redirectedAlloc.room_id, roomB_F1.id);
    assert.strictEqual(redirectedAlloc.is_clean, false, 'Redirect allocations must be flagged for review');

    // Confirm student application has clear redirect reason and redirect_from_hostel_id
    const updatedApp = redirectedAlloc.application;
    assert.strictEqual(updatedApp.redirect_from_hostel_id, testHostelA.id);
    assert.ok(
      updatedApp.redirect_reason.includes('capacity') || updatedApp.redirect_reason.includes('redirected'),
      'Student must see clear redirect reason'
    );
    assert.strictEqual(updatedApp.status, 'FLAGGED');
  });

  // --------------------------------------------------------------------------
  // TEST 6: Zero Vacancy Campus-Wide Produces ESCALATED State
  // --------------------------------------------------------------------------
  test('Checklist 5: Zero vacancy campus-wide produces ESCALATED state for manual placement', async () => {
    // 1. Temporarily set all non-test boys hostel rooms to MAINTENANCE
    await prisma.room.updateMany({
      where: {
        hostel: { type: 'BOYS' },
        hostel_id: { notIn: [testHostelA.id, testHostelB.id] },
      },
      data: { status: 'MAINTENANCE' },
    });

    try {
      // 2. Ensure all rooms in testHostelA and testHostelB are 100% full
      const fillStudA1 = await createTestStudent({ name: 'Filler A1', rollNumber: `FA1_${testSuffix}`, hostelId: testHostelA.id, roomId: roomA_F1.id });
      const fillStudA2 = await createTestStudent({ name: 'Filler A2', rollNumber: `FA2_${testSuffix}`, hostelId: testHostelA.id, roomId: roomA_F2.id });
      const fillStudA3 = await createTestStudent({ name: 'Filler A3', rollNumber: `FA3_${testSuffix}`, hostelId: testHostelA.id, roomId: roomA_F3.id });
      const fillStudB1 = await createTestStudent({ name: 'Filler B1', rollNumber: `FB1_${testSuffix}`, hostelId: testHostelB.id, roomId: roomB_F1.id });

      // Clean up previous allocations/applications for this run
      await prisma.roomAllocation.deleteMany({ where: { hostel_id: { in: [testHostelA.id, testHostelB.id] } } });
      await prisma.hostelApplication.deleteMany({ where: { hostel_id: { in: [testHostelA.id, testHostelB.id] } } });

      // 3. Create an applicant when 0 seats exist anywhere for BOYS
      const unplacedStudent = await createTestStudent({
        name: 'Unplaced Student',
        rollNumber: `UNP_${testSuffix}`,
        hostelId: testHostelA.id,
      });

      const appRecord = await prisma.hostelApplication.create({
        data: {
          window_id: windowA.id,
          student_id: unplacedStudent.student.id,
          hostel_id: testHostelA.id,
          year_of_study: 1,
          is_renewal: false,
          status: 'PENDING',
        },
      });

      // 4. Run batch allocation
      const batchRes = await request(app)
        .post('/api/allocations/batches/run')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          window_id: windowA.id,
          hostel_id: testHostelA.id,
          lottery_seed: 'seed_zero_vacancy',
        });
      assert.strictEqual(batchRes.status, 201);

      const escalatedApp = await prisma.hostelApplication.findUnique({
        where: { id: appRecord.id },
      });
      assert.strictEqual(escalatedApp.status, 'ESCALATED', 'Zero vacancy campus-wide must mark application ESCALATED');
      assert.ok(escalatedApp.flag_reason.includes('Zero vacancy campus-wide'), 'Must explain reason to admin and student');

      // 5. Super Admin manual placement for ESCALATED applicant
      const extraRoom = await prisma.room.create({
        data: {
          hostel_id: testHostelA.id,
          room_number: `A-EXTRA`,
          floor: 1,
          capacity: 1,
          status: 'ACTIVE',
        },
      });

      const manualPlaceRes = await request(app)
        .patch(`/api/allocations/applications/${escalatedApp.id}/manual-place`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          hostel_id: testHostelA.id,
          room_id: extraRoom.id,
          notes: 'Manually placed in designated emergency reserve room',
        });
      assert.strictEqual(manualPlaceRes.status, 200);

      const placedStudent = await prisma.student.findUnique({ where: { id: unplacedStudent.student.id } });
      assert.strictEqual(placedStudent.room_id, extraRoom.id, 'Manual placement must set student room_id');
    } finally {
      // Restore room statuses for all other hostels
      await prisma.room.updateMany({
        where: {
          hostel: { type: 'BOYS' },
          hostel_id: { notIn: [testHostelA.id, testHostelB.id] },
        },
        data: { status: 'ACTIVE' },
      });
    }
  });

  // --------------------------------------------------------------------------
  // TEST 7: Bulk-Confirm Clean Allocations & Atomicity of room_id
  // --------------------------------------------------------------------------
  test('Caretaker / Warden review: Bulk-confirm clean allocations sets students.room_id atomically', async () => {
    // Find batch created earlier with proposed allocations
    const latestBatch = await prisma.allocationBatch.findFirst({
      where: { hostel_id: testHostelA.id },
      orderBy: { created_at: 'desc' },
      include: { allocations: true },
    });
    assert.ok(latestBatch);

    const cleanProposedBefore = await prisma.roomAllocation.findMany({
      where: { batch_id: latestBatch.id, is_clean: true, status: 'PROPOSED' },
    });

    if (cleanProposedBefore.length > 0) {
      const bulkRes = await request(app)
        .post(`/api/allocations/batches/${latestBatch.id}/confirm-clean`)
        .set('Authorization', `Bearer ${caretakerToken}`);
      assert.strictEqual(bulkRes.status, 200);
      assert.strictEqual(bulkRes.body.confirmed_count, cleanProposedBefore.length);

      for (const alloc of cleanProposedBefore) {
        const studentRecord = await prisma.student.findUnique({ where: { id: alloc.student_id } });
        assert.strictEqual(studentRecord.room_id, alloc.room_id, 'Bulk confirm must atomically set room_id');
      }
    }
  });

  // --------------------------------------------------------------------------
  // TEST 8: Room Swap Requests — Same-Tier (Caretaker) vs Cross-Tier (Warden Guard)
  // --------------------------------------------------------------------------
  test('Checklist 6: Same-tier swap approved by Caretaker; Cross-tier swap blocked for Caretaker (403) and approved by Warden', async () => {
    // Setup 3 students with active rooms:
    // Student 1: Floor 1 (roomA_F1)
    // Student 2: Floor 1 (extra room on floor 1, so same-tier)
    // Student 3: Floor 3 (roomA_F3, floor 3, so cross-tier)
    const extraRoomF1 = await prisma.room.create({
      data: {
        hostel_id: testHostelA.id,
        room_number: `A-102-SWAP`,
        floor: 1,
        capacity: 1,
        status: 'ACTIVE',
      },
    });

    const swapStudent1 = await createTestStudent({
      name: 'Swap Student 1',
      rollNumber: `SWAP1_${testSuffix}`,
      hostelId: testHostelA.id,
      roomId: roomA_F1.id,
      year: 1,
    });

    const swapStudent2 = await createTestStudent({
      name: 'Swap Student 2',
      rollNumber: `SWAP2_${testSuffix}`,
      hostelId: testHostelA.id,
      roomId: extraRoomF1.id,
      year: 1,
    });

    const swapStudent3 = await createTestStudent({
      name: 'Swap Student 3',
      rollNumber: `SWAP3_${testSuffix}`,
      hostelId: testHostelA.id,
      roomId: roomA_F3.id,
      year: 3,
    });

    // 8a. Same-Tier Swap: Student 1 <-> Student 2 (both Floor 1)
    const swapReqRes1 = await request(app)
      .post('/api/allocations/swaps')
      .set('Authorization', `Bearer ${swapStudent1.token}`)
      .send({
        target_student_id: swapStudent2.student.id,
        note: 'Prefer room closer to reading hall',
      });
    assert.strictEqual(swapReqRes1.status, 201);
    const swap1 = swapReqRes1.body.swap;
    assert.strictEqual(swap1.is_cross_tier, false, 'Same floor must NOT be cross-tier');
    assert.strictEqual(swap1.status, 'PENDING_PEER_ACCEPTANCE');

    // Peer acceptance by Student 2
    const acceptRes1 = await request(app)
      .patch(`/api/allocations/swaps/${swap1.id}/peer-accept`)
      .set('Authorization', `Bearer ${swapStudent2.token}`);
    assert.strictEqual(acceptRes1.status, 200);
    assert.strictEqual(acceptRes1.body.swap.status, 'PEER_ACCEPTED');

    // Caretaker approves same-tier swap directly
    const approveRes1 = await request(app)
      .patch(`/api/allocations/swaps/${swap1.id}/decide`)
      .set('Authorization', `Bearer ${caretakerToken}`)
      .send({ action: 'APPROVE', decision_note: 'Same floor swap verified and approved' });
    assert.strictEqual(approveRes1.status, 200);
    assert.strictEqual(approveRes1.body.swap.status, 'APPROVED');

    // Verify rooms are swapped atomically in DB
    const updatedS1 = await prisma.student.findUnique({ where: { id: swapStudent1.student.id } });
    const updatedS2 = await prisma.student.findUnique({ where: { id: swapStudent2.student.id } });
    assert.strictEqual(updatedS1.room_id, extraRoomF1.id, 'Student 1 must now have Student 2 original room');
    assert.strictEqual(updatedS2.room_id, roomA_F1.id, 'Student 2 must now have Student 1 original room');

    // 8b. Cross-Tier Swap: Student 1 (now in extraRoomF1 on floor 1) <-> Student 3 (in roomA_F3 on floor 3)
    const swapReqRes2 = await request(app)
      .post('/api/allocations/swaps')
      .set('Authorization', `Bearer ${swapStudent1.token}`)
      .send({
        target_student_id: swapStudent3.student.id,
        note: 'Want to move to Floor 3',
      });
    assert.strictEqual(swapReqRes2.status, 201);
    const swap2 = swapReqRes2.body.swap;
    assert.strictEqual(swap2.is_cross_tier, true, 'Different floors must be detected as cross-tier');

    // Peer acceptance by Student 3
    const acceptRes2 = await request(app)
      .patch(`/api/allocations/swaps/${swap2.id}/peer-accept`)
      .set('Authorization', `Bearer ${swapStudent3.token}`);
    assert.strictEqual(acceptRes2.status, 200);
    assert.strictEqual(acceptRes2.body.swap.status, 'ESCALATED_TO_WARDEN', 'Cross-tier automatically escalates to Warden');

    // Caretaker tries to approve cross-tier swap -> MUST return 403 Forbidden!
    const caretakerFailRes = await request(app)
      .patch(`/api/allocations/swaps/${swap2.id}/decide`)
      .set('Authorization', `Bearer ${caretakerToken}`)
      .send({ action: 'APPROVE', decision_note: 'Caretaker trying to approve cross-tier' });
    assert.strictEqual(caretakerFailRes.status, 403, 'Caretaker cannot approve cross-tier swap (HTTP 403 required)');
    assert.ok(caretakerFailRes.body.error.includes('Warden approval'));

    // Warden approves cross-tier swap -> MUST succeed!
    const wardenApproveRes = await request(app)
      .patch(`/api/allocations/swaps/${swap2.id}/decide`)
      .set('Authorization', `Bearer ${wardenToken}`)
      .send({ action: 'APPROVE', decision_note: 'Warden approved cross-tier mapping exemption' });
    assert.strictEqual(wardenApproveRes.status, 200);
    assert.strictEqual(wardenApproveRes.body.swap.status, 'APPROVED');

    // Confirm rooms swapped atomically
    const finalS1 = await prisma.student.findUnique({ where: { id: swapStudent1.student.id } });
    const finalS3 = await prisma.student.findUnique({ where: { id: swapStudent3.student.id } });
    assert.strictEqual(finalS1.room_id, roomA_F3.id, 'Student 1 must now be in Floor 3 room');
    assert.strictEqual(finalS3.room_id, extraRoomF1.id, 'Student 3 must now be in Floor 1 room');
  });
});
