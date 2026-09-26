import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { app, verifyDeviceSecretsIntegrity } from '../src/index.js';
import prisma from '../src/prisma.js';
import { generateAccessToken } from '../src/utils/token.js';
import { generateQrToken, validateAndConsume } from '../src/services/qrTokenService.js';

describe('Phase 13: Security Regressions, Kiosk Ownership & Tiered Leave Approval', () => {
  let superAdminUser;
  let superAdminToken;

  let h1CaretakerUser;
  let h1CaretakerToken;

  let boysWardenUser;
  let boysWardenToken;

  let girlsWardenUser;
  let girlsWardenToken;

  let studentH1;
  let studentH1User;
  let studentH1Token;

  let studentH7;
  let studentH7User;
  let studentH7Token;

  let hostelH1;
  let hostelH5;
  let hostelH7;

  let gateA;
  let gateB;
  let deviceGateA;
  let deviceGateB;
  let deviceGateASecret;
  let deviceGateBSecret;

  before(async () => {
    // 1. Fetch Super Admin
    superAdminUser = await prisma.user.findUnique({ where: { email: 'admin@hostel360.com' } });
    superAdminToken = generateAccessToken(superAdminUser);

    // 2. Fetch H1 Caretaker
    h1CaretakerUser = await prisma.user.findUnique({
      where: { email: 'caretaker.h1@hostel360.com' },
      include: { staff_hostel_assignments: true },
    });
    h1CaretakerToken = generateAccessToken(h1CaretakerUser);

    // 3. Fetch Wardens
    boysWardenUser = await prisma.user.findUnique({
      where: { email: 'warden.boys@hostel360.com' },
      include: { staff_hostel_assignments: true },
    });
    boysWardenToken = generateAccessToken(boysWardenUser);

    girlsWardenUser = await prisma.user.findUnique({
      where: { email: 'warden.girls@hostel360.com' },
      include: { staff_hostel_assignments: true },
    });
    girlsWardenToken = generateAccessToken(girlsWardenUser);

    // 4. Fetch Hostels
    hostelH1 = await prisma.hostel.findUnique({ where: { code: 'H1' } });
    hostelH5 = await prisma.hostel.findUnique({ where: { code: 'H5' } });
    hostelH7 = await prisma.hostel.findUnique({ where: { code: 'H7' } }); // Girls hostel

    // 5. Create dedicated test students to avoid concurrent cross-test interference
    const testSalt = await bcrypt.genSalt(10);
    const testPwd = await bcrypt.hash('password123', testSalt);

    const roomH1 = await prisma.room.findFirst({ where: { hostel_id: hostelH1.id } });
    studentH1User = await prisma.user.create({
      data: {
        name: 'Tiered Test Student H1',
        email: `student.h1.test.${Date.now()}@hostel360.com`,
        password_hash: testPwd,
        role: 'STUDENT',
        is_active: true,
      },
    });
    studentH1 = await prisma.student.create({
      data: {
        user_id: studentH1User.id,
        roll_number: `TIER_H1_${Date.now().toString().slice(-6)}`,
        gender: 'MALE',
        hostel_id: hostelH1.id,
        room_id: roomH1.id,
        current_state: 'INSIDE',
      },
      include: { user: true, hostel: true },
    });
    studentH1Token = generateAccessToken(studentH1User);

    const roomH7 = await prisma.room.findFirst({ where: { hostel_id: hostelH7.id } });
    studentH7User = await prisma.user.create({
      data: {
        name: 'Tiered Test Student H7',
        email: `student.h7.test.${Date.now()}@hostel360.com`,
        password_hash: testPwd,
        role: 'STUDENT',
        is_active: true,
      },
    });
    studentH7 = await prisma.student.create({
      data: {
        user_id: studentH7User.id,
        roll_number: `TIER_H7_${Date.now().toString().slice(-6)}`,
        gender: 'FEMALE',
        hostel_id: hostelH7.id,
        room_id: roomH7.id,
        current_state: 'INSIDE',
      },
      include: { user: true, hostel: true },
    });
    studentH7Token = generateAccessToken(studentH7User);

    // 6. Setup Gates & Distinct Devices for Gate A (H1) and Gate B (H5)
    gateA = await prisma.gate.findFirst({ where: { hostel_id: hostelH1.id } });
    gateB = await prisma.gate.findFirst({ where: { hostel_id: hostelH5.id } });

    deviceGateASecret = crypto.randomBytes(32).toString('hex');
    const hashA = await bcrypt.hash(deviceGateASecret, 10);
    deviceGateA = await prisma.device.create({
      data: {
        device_code: `TEST_GATE_A_${Date.now()}`,
        device_name: 'Test Gate A Device',
        purpose: 'GATE',
        gate_id: gateA.id,
        secret_hash: hashA,
        is_active: true,
        registered_by: superAdminUser.id,
      },
    });

    deviceGateBSecret = crypto.randomBytes(32).toString('hex');
    const hashB = await bcrypt.hash(deviceGateBSecret, 10);
    deviceGateB = await prisma.device.create({
      data: {
        device_code: `TEST_GATE_B_${Date.now()}`,
        device_name: 'Test Gate B Device',
        purpose: 'GATE',
        gate_id: gateB.id,
        secret_hash: hashB,
        is_active: true,
        registered_by: superAdminUser.id,
      },
    });
  });

  after(async () => {
    // Cleanup created test records safely
    if (studentH1) {
      await prisma.leaveRequest.deleteMany({ where: { student_id: studentH1.id } });
      await prisma.hostelAttendance.deleteMany({ where: { student_id: studentH1.id } });
      await prisma.student.delete({ where: { id: studentH1.id } });
      await prisma.user.delete({ where: { id: studentH1User.id } });
    }
    if (studentH7) {
      await prisma.leaveRequest.deleteMany({ where: { student_id: studentH7.id } });
      await prisma.hostelAttendance.deleteMany({ where: { student_id: studentH7.id } });
      await prisma.student.delete({ where: { id: studentH7.id } });
      await prisma.user.delete({ where: { id: studentH7User.id } });
    }
    if (deviceGateA) {
      await prisma.hostelAttendance.deleteMany({ where: { device_id: deviceGateA.id } });
      await prisma.qrToken.deleteMany({ where: { device_id: deviceGateA.id } });
      await prisma.device.delete({ where: { id: deviceGateA.id } });
    }
    if (deviceGateB) {
      await prisma.hostelAttendance.deleteMany({ where: { device_id: deviceGateB.id } });
      await prisma.qrToken.deleteMany({ where: { device_id: deviceGateB.id } });
      await prisma.device.delete({ where: { id: deviceGateB.id } });
    }
  });

  // ==========================================
  // PART A: SECURITY REGRESSIONS
  // ==========================================

  test('Part A.1 & A.3 (a): Token issued by Gate A is rejected when presented against Gate B context', async () => {
    // Issue token from Gate A
    const tokenResultA = await generateQrToken(deviceGateA);
    assert.ok(tokenResultA.token, 'Gate A token should be generated');

    // 1. Validate against deviceGateB ID directly
    const directConsumeResult = await validateAndConsume(tokenResultA.token, deviceGateB.id);
    assert.strictEqual(directConsumeResult.valid, false);
    assert.strictEqual(directConsumeResult.code, 'DEVICE_MISMATCH');

    // Issue a fresh token for attendance scan API test
    const tokenResultA2 = await generateQrToken(deviceGateA);

    // 2. Present Gate A token with device_id of Gate B at /api/attendance/scan
    const resMismatch = await request(app)
      .post('/api/attendance/scan')
      .set('Authorization', `Bearer ${studentH1Token}`)
      .send({
        token: tokenResultA2.token,
        device_id: deviceGateB.id,
      });

    assert.strictEqual(resMismatch.status, 400);
    assert.strictEqual(resMismatch.body.code, 'DEVICE_MISMATCH');

    // 3. Present Gate B token (from H5) by student of H1 (hostel boundary check)
    const tokenResultB = await generateQrToken(deviceGateB);
    const resHostelMismatch = await request(app)
      .post('/api/attendance/scan')
      .set('Authorization', `Bearer ${studentH1Token}`)
      .send({
        token: tokenResultB.token,
      });

    assert.strictEqual(resHostelMismatch.status, 403);
    assert.strictEqual(resHostelMismatch.body.code, 'HOSTEL_MISMATCH');
  });

  test('Part A.2 & A.3 (b): Two devices can never be registered with identical secret hashes', async () => {
    // Generate an arbitrary secret and hash
    const duplicateSecret = crypto.randomBytes(32).toString('hex');
    const duplicateHash = await bcrypt.hash(duplicateSecret, 10);

    const testDevice1 = await prisma.device.create({
      data: {
        device_code: `DUP_TEST_1_${Date.now()}`,
        device_name: 'Dup Test 1',
        purpose: 'GATE',
        gate_id: gateA.id,
        secret_hash: duplicateHash,
        is_active: true,
        registered_by: superAdminUser.id,
      },
    });

    // Attempting to create a second device with identical secret_hash must be rejected by unique constraint
    await assert.rejects(
      async () => {
        await prisma.device.create({
          data: {
            device_code: `DUP_TEST_2_${Date.now()}`,
            device_name: 'Dup Test 2',
            purpose: 'GATE',
            gate_id: gateB.id,
            secret_hash: duplicateHash,
            is_active: true,
            registered_by: superAdminUser.id,
          },
        });
      },
      (err) => {
        assert.ok(err.message.includes('Unique constraint') || err.code === 'P2002');
        return true;
      }
    );

    // Cleanup testDevice1
    await prisma.device.delete({ where: { id: testDevice1.id } });
  });

  test('Part A.2 Startup Check: verifyDeviceSecretsIntegrity passes when all active device hashes are unique', async () => {
    const isIntegrityValid = await verifyDeviceSecretsIntegrity();
    assert.strictEqual(isIntegrityValid, true);
  });

  // ==========================================
  // PART B: CARETAKER KIOSK OWNERSHIP
  // ==========================================

  test('Part B.1: Caretaker can list "My Kiosks" scoped to their assigned hostel', async () => {
    const res = await request(app)
      .get('/api/devices/my-kiosks')
      .set('Authorization', `Bearer ${h1CaretakerToken}`);

    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.devices));
    // Must contain deviceGateA (at H1), but NOT deviceGateB (at H5)
    const containsGateA = res.body.devices.some((d) => d.id === deviceGateA.id);
    const containsGateB = res.body.devices.some((d) => d.id === deviceGateB.id);

    assert.strictEqual(containsGateA, true, 'H1 Caretaker should see H1 Gate device');
    assert.strictEqual(containsGateB, false, 'H1 Caretaker should NOT see H5 Gate device');

    // Check enriched health info
    const devA = res.body.devices.find((d) => d.id === deviceGateA.id);
    assert.ok('is_online' in devA);
    assert.ok('issuance_health' in devA);
  });

  test('Part B.2: Caretaker can force token refresh on their assigned kiosk', async () => {
    // Generate an UNUSED token for deviceGateA
    const priorToken = await generateQrToken(deviceGateA);
    assert.strictEqual(priorToken.record.status, 'UNUSED');

    const res = await request(app)
      .post(`/api/devices/${deviceGateA.id}/force-refresh`)
      .set('Authorization', `Bearer ${h1CaretakerToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.ok, true);

    // Prior token must now be REVOKED
    const updatedPrior = await prisma.qrToken.findUnique({ where: { id: priorToken.record.id } });
    assert.strictEqual(updatedPrior.status, 'REVOKED');
  });

  test('Part B.2 Scoping: Caretaker cannot force token refresh on another hostel kiosk', async () => {
    const res = await request(app)
      .post(`/api/devices/${deviceGateB.id}/force-refresh`)
      .set('Authorization', `Bearer ${h1CaretakerToken}`);

    assert.strictEqual(res.status, 403);
    assert.ok(res.body.error.includes('Access denied'));
  });

  test('Part B.3: Caretaker can report malfunction to Super Admin without deactivating device', async () => {
    const res = await request(app)
      .post(`/api/devices/${deviceGateA.id}/report-malfunction`)
      .set('Authorization', `Bearer ${h1CaretakerToken}`)
      .send({ note: 'Wall screen flickering intermittently after rain' });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.ok, true);

    // Verify device remains active
    const dev = await prisma.device.findUnique({ where: { id: deviceGateA.id } });
    assert.strictEqual(dev.is_active, true, 'Reporting malfunction must not deactivate device');

    // Verify AuditLog was recorded
    const audit = await prisma.auditLog.findFirst({
      where: {
        target_id: deviceGateA.id,
        action: 'DEVICE_MALFUNCTION_REPORTED',
      },
      orderBy: { created_at: 'desc' },
    });
    assert.ok(audit);
    assert.strictEqual(audit.meta.note, 'Wall screen flickering intermittently after rain');
  });

  test('Part B.4 Permissions Test: Caretaker request to device-provisioning endpoints is rejected (HTTP 403)', async () => {
    // 1. Try registering a device as Caretaker
    const resRegister = await request(app)
      .post('/api/devices/register')
      .set('Authorization', `Bearer ${h1CaretakerToken}`)
      .send({
        device_name: 'Malicious Kiosk',
        purpose: 'GATE',
        gate_id: gateA.id,
      });
    assert.strictEqual(resRegister.status, 403);

    // 2. Try disabling a device as Caretaker
    const resDisable = await request(app)
      .patch(`/api/devices/${deviceGateA.id}/disable`)
      .set('Authorization', `Bearer ${h1CaretakerToken}`);
    assert.strictEqual(resDisable.status, 403);

    // 3. Try fetching full admin device list as Caretaker
    const resList = await request(app)
      .get('/api/devices')
      .set('Authorization', `Bearer ${h1CaretakerToken}`);
    assert.strictEqual(resList.status, 403);
  });

  // ==========================================
  // PART C: TIERED LEAVE-REQUEST APPROVAL
  // ==========================================

  test('Part C Checklist 1: A 2-hour same-day request with no curfew overlap -> tier LOW, Caretaker can approve directly', async () => {
    // Curfew is at 21:00 to 06:00. Same-day 14:00 to 16:00 (2h)
    const today = new Date();
    today.setHours(14, 0, 0, 0);
    const returnTime = new Date(today.getTime() + 2 * 60 * 60 * 1000); // 16:00

    const submitRes = await request(app)
      .post('/api/curfew/leave-requests')
      .set('Authorization', `Bearer ${studentH1Token}`)
      .send({
        requested_from: today.toISOString(),
        requested_to: returnTime.toISOString(),
        reason: 'Book purchase at New Market Bhopal',
      });

    assert.strictEqual(submitRes.status, 201);
    const leaveId = submitRes.body.leave_request?.id;
    assert.strictEqual(submitRes.body.leave_request.risk_tier, 'LOW');
    assert.strictEqual(submitRes.body.leave_request.status, 'PENDING');

    // Caretaker directly APPROVES the LOW-tier request
    const approveRes = await request(app)
      .patch(`/api/curfew/leave-requests/${leaveId}/status`)
      .set('Authorization', `Bearer ${h1CaretakerToken}`)
      .send({ status: 'APPROVED' });

    assert.strictEqual(approveRes.status, 200);
    assert.strictEqual(approveRes.body.leave_request.status, 'APPROVED');
    assert.strictEqual(approveRes.body.leave_request.decided_by, h1CaretakerUser.id);
  });

  test('Part C Checklist 2: An overnight request -> tier HIGH, Caretaker can only verify, status stays PENDING until Warden decides', async () => {
    // Overnight request (spans curfew 21:00 to 06:00)
    const depart = new Date();
    depart.setHours(18, 0, 0, 0);
    const arrive = new Date(depart.getTime() + 14 * 60 * 60 * 1000); // next day 08:00

    const submitRes = await request(app)
      .post('/api/curfew/leave-requests')
      .set('Authorization', `Bearer ${studentH1Token}`)
      .send({
        requested_from: depart.toISOString(),
        requested_to: arrive.toISOString(),
        reason: 'Family visit over weekend in Indore',
      });

    assert.strictEqual(submitRes.status, 201);
    const leaveId = submitRes.body.leave_request.id;
    assert.strictEqual(submitRes.body.leave_request.risk_tier, 'HIGH');
    assert.strictEqual(submitRes.body.leave_request.status, 'PENDING');

    // 1. Caretaker tries to directly APPROVE HIGH-tier request -> MUST BE REJECTED with HTTP 403
    const directApproveRes = await request(app)
      .patch(`/api/curfew/leave-requests/${leaveId}/status`)
      .set('Authorization', `Bearer ${h1CaretakerToken}`)
      .send({ status: 'APPROVED' });

    assert.strictEqual(directApproveRes.status, 403);
    assert.strictEqual(directApproveRes.body.code, 'TIER_REQUIRES_WARDEN');

    // 2. Caretaker submits verification note
    const verifyRes = await request(app)
      .patch(`/api/curfew/leave-requests/${leaveId}/verify`)
      .set('Authorization', `Bearer ${h1CaretakerToken}`)
      .send({ note: 'Parent verbal confirmation received by telephone' });

    assert.strictEqual(verifyRes.status, 200);
    assert.strictEqual(verifyRes.body.leave_request.status, 'PENDING', 'Status must remain PENDING after Caretaker verification');
    assert.strictEqual(verifyRes.body.leave_request.caretaker_verified_by, h1CaretakerUser.id);
    assert.strictEqual(verifyRes.body.leave_request.caretaker_note, 'Parent verbal confirmation received by telephone');

    // 3. Warden reviews and decides on HIGH-tier request
    const wardenApproveRes = await request(app)
      .patch(`/api/curfew/leave-requests/${leaveId}/status`)
      .set('Authorization', `Bearer ${boysWardenToken}`)
      .send({ status: 'APPROVED' });

    assert.strictEqual(wardenApproveRes.status, 200);
    assert.strictEqual(wardenApproveRes.body.leave_request.status, 'APPROVED');
    assert.strictEqual(wardenApproveRes.body.leave_request.decided_by, boysWardenUser.id);
  });

  test('Part C Checklist 3: A LOW request edited to extend past curfew window -> re-tiers to HIGH and blocks Caretaker direct decision', async () => {
    // 1. Create a 3-hour daytime request (13:00 to 16:00) -> LOW
    const fromDate = new Date();
    fromDate.setHours(13, 0, 0, 0);
    const toDate = new Date(fromDate.getTime() + 3 * 60 * 60 * 1000); // 16:00

    const submitRes = await request(app)
      .post('/api/curfew/leave-requests')
      .set('Authorization', `Bearer ${studentH1Token}`)
      .send({
        requested_from: fromDate.toISOString(),
        requested_to: toDate.toISOString(),
        reason: 'Library study group',
      });

    assert.strictEqual(submitRes.status, 201);
    const leaveId = submitRes.body.leave_request.id;
    assert.strictEqual(submitRes.body.leave_request.risk_tier, 'LOW');

    // 2. Student edits request to extend past 21:00 curfew (e.g. up to 23:00)
    const extendedTo = new Date(fromDate.getTime() + 10 * 60 * 60 * 1000); // 23:00 (overlaps 21:00 curfew and 10h > 8h)
    const editRes = await request(app)
      .patch(`/api/curfew/leave-requests/${leaveId}`)
      .set('Authorization', `Bearer ${studentH1Token}`)
      .send({
        requested_from: fromDate.toISOString(),
        requested_to: extendedTo.toISOString(),
        reason: 'Library study group extended for lab project',
      });

    assert.strictEqual(editRes.status, 200);
    assert.strictEqual(editRes.body.leave_request.risk_tier, 'HIGH', 'Edited request must dynamically re-tier to HIGH');

    // 3. Caretaker tries to directly APPROVE -> blocked because it is now HIGH tier
    const caretakerAttempt = await request(app)
      .patch(`/api/curfew/leave-requests/${leaveId}/status`)
      .set('Authorization', `Bearer ${h1CaretakerToken}`)
      .send({ status: 'APPROVED' });

    assert.strictEqual(caretakerAttempt.status, 403);
    assert.strictEqual(caretakerAttempt.body.code, 'TIER_REQUIRES_WARDEN');
  });

  test("Part C Checklist 4: Girls' hostels (H7, H12) scoping holds for leave requests at both tiers", async () => {
    // 1. Student H7 creates a leave request
    const depart = new Date();
    depart.setHours(14, 0, 0, 0);
    const arrive = new Date(depart.getTime() + 2 * 60 * 60 * 1000); // LOW tier

    const submitH7 = await request(app)
      .post('/api/curfew/leave-requests')
      .set('Authorization', `Bearer ${studentH7Token}`)
      .send({
        requested_from: depart.toISOString(),
        requested_to: arrive.toISOString(),
        reason: 'Project meeting at department',
      });

    assert.strictEqual(submitH7.status, 201);
    const h7LeaveId = submitH7.body.leave_request.id;

    // 2. H1 Caretaker (assigned only to H1) tries to view or approve H7 leave request -> FORBIDDEN
    const caretakerAction = await request(app)
      .patch(`/api/curfew/leave-requests/${h7LeaveId}/status`)
      .set('Authorization', `Bearer ${h1CaretakerToken}`)
      .send({ status: 'APPROVED' });
    assert.strictEqual(caretakerAction.status, 403);

    // 3. Boys' Warden (assigned to H1-H4, H6, H8-H11) tries to approve H7 leave request -> FORBIDDEN
    const boysWardenAction = await request(app)
      .patch(`/api/curfew/leave-requests/${h7LeaveId}/status`)
      .set('Authorization', `Bearer ${boysWardenToken}`)
      .send({ status: 'APPROVED' });
    assert.strictEqual(boysWardenAction.status, 403);

    // 4. Girls' Warden (assigned to H7 & H12) CAN view and approve
    const girlsWardenAction = await request(app)
      .patch(`/api/curfew/leave-requests/${h7LeaveId}/status`)
      .set('Authorization', `Bearer ${girlsWardenToken}`)
      .send({ status: 'APPROVED' });
    assert.strictEqual(girlsWardenAction.status, 200);
    assert.strictEqual(girlsWardenAction.body.leave_request.status, 'APPROVED');
  });
});
