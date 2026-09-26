import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { app } from '../src/index.js';
import prisma from '../src/prisma.js';
import { generateQrToken } from '../src/services/qrTokenService.js';
import {
  isDateInCurfewWindow,
  getActiveCurfewWindowsForHostel,
  isStudentInCurfew,
  triggerCurfewSweep,
} from '../src/services/curfewService.js';

describe('Continuous-Logging Curfew System Tests (Phase 12)', () => {
  let studentToken = '';
  let studentUser = null;
  let studentRecord = null;
  let adminToken = '';
  let adminUser = null;
  let wardenToken = '';
  let gateDevice = null;
  let testHostel = null;

  before(async () => {
    // 1. Authenticate Student
    const studentLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'aarav.sharma@student.hostel360.com',
        password: 'password123',
      });
    assert.strictEqual(studentLogin.status, 200);
    studentToken = studentLogin.body.accessToken;
    studentUser = studentLogin.body.user;

    studentRecord = await prisma.student.findUnique({
      where: { user_id: studentUser.id },
      include: { hostel: true },
    });
    assert.ok(studentRecord, 'Student must exist in DB');
    testHostel = studentRecord.hostel;

    // 2. Authenticate Super Admin
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@hostel360.com',
        password: 'password123',
      });
    assert.strictEqual(adminLogin.status, 200);
    adminToken = adminLogin.body.accessToken;
    adminUser = adminLogin.body.user;

    // 3. Authenticate Warden
    const wardenLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'warden.boys@hostel360.com',
        password: 'password123',
      });
    assert.strictEqual(wardenLogin.status, 200);
    wardenToken = wardenLogin.body.accessToken;

    // 4. Ensure gate device exists for student's hostel
    gateDevice = await prisma.device.findFirst({
      where: {
        purpose: 'GATE',
        is_active: true,
        gate: { hostel_id: studentRecord.hostel_id },
      },
    });
    if (!gateDevice) {
      let gate = await prisma.gate.findFirst({ where: { hostel_id: studentRecord.hostel_id } });
      if (!gate) {
        gate = await prisma.gate.create({
          data: {
            hostel_id: studentRecord.hostel_id,
            name: 'Main Gate Test',
          },
        });
      }
      gateDevice = await prisma.device.create({
        data: {
          device_name: `${gate.name} Kiosk`,
          device_code: `GATE_TEST_${Date.now()}`,
          purpose: 'GATE',
          gate_id: gate.id,
          is_active: true,
          secret_hash: 'dummy',
          registered_by: adminUser.id,
        },
      });
    }

    // Clean up any lingering test curfew windows or alerts for clean slate
    await prisma.curfewAlert.deleteMany({
      where: { student_id: studentRecord.id },
    });
    await prisma.leaveRequest.deleteMany({
      where: { student_id: studentRecord.id },
    });
    await prisma.curfewWindow.deleteMany({
      where: { hostel_id: studentRecord.hostel_id },
    });
  });

  after(async () => {
    // Cleanup
    await prisma.curfewAlert.deleteMany({
      where: { student_id: studentRecord?.id },
    });
    await prisma.leaveRequest.deleteMany({
      where: { student_id: studentRecord?.id },
    });
    await prisma.curfewWindow.deleteMany({
      where: { hostel_id: studentRecord?.hostel_id },
    });
  });

  test('12.2 Unit Test: Midnight wrap calculation (21:00 to 06:00)', () => {
    const window = {
      day_type: 'EVERYDAY',
      start_time: '21:00',
      end_time: '06:00',
      is_active: true,
    };

    // 20:55 (8:55 PM) — before curfew
    const d855pm = new Date('2026-09-26T20:55:00');
    assert.strictEqual(isDateInCurfewWindow(window, d855pm), false, '8:55 PM should be outside curfew');

    // 21:00 (9:00 PM) — at start of curfew
    const d9pm = new Date('2026-09-26T21:00:00');
    assert.strictEqual(isDateInCurfewWindow(window, d9pm), true, '9:00 PM should be inside curfew');

    // 23:00 (11:00 PM) — during curfew
    const d11pm = new Date('2026-09-26T23:00:00');
    assert.strictEqual(isDateInCurfewWindow(window, d11pm), true, '11:00 PM should be inside curfew');

    // 02:00 (2:00 AM) — overnight across midnight
    const d2am = new Date('2026-09-27T02:00:00');
    assert.strictEqual(isDateInCurfewWindow(window, d2am), true, '2:00 AM should be inside curfew (midnight wrap)');

    // 06:05 (6:05 AM) — after curfew
    const d605am = new Date('2026-09-27T06:05:00');
    assert.strictEqual(isDateInCurfewWindow(window, d605am), false, '6:05 AM should be outside curfew');
  });

  test('12.2 Fallback: Hostel with no specific curfew window falls back to campus-wide default (hostel_id IS NULL)', async () => {
    // 1. Ensure campus-wide default exists
    let campusDefault = await prisma.curfewWindow.findFirst({
      where: { hostel_id: null, is_active: true },
    });
    if (!campusDefault) {
      campusDefault = await prisma.curfewWindow.create({
        data: {
          hostel_id: null,
          day_type: 'EVERYDAY',
          start_time: '22:00',
          end_time: '05:30',
          grace_period_minutes: 30,
          is_active: true,
          updated_by: adminUser.id,
        },
      });
    }

    // 2. Fetch active windows for student hostel (which has no specific row)
    const activeWindows = await getActiveCurfewWindowsForHostel(studentRecord.hostel_id);
    assert.ok(activeWindows.length > 0, 'Must fall back to campus default window');
    assert.strictEqual(activeWindows[0].hostel_id, null, 'Hostel ID must be null representing campus default');
  });

  test('12.3 Job B Real-Time Exit During Curfew Alert: Exit at 23:00 with no leave request creates EXIT_DURING_CURFEW alert immediately', async () => {
    // Configure an active curfew window covering 00:00 to 23:59 (active right now)
    const window = await prisma.curfewWindow.create({
      data: {
        hostel_id: studentRecord.hostel_id,
        day_type: 'EVERYDAY',
        start_time: '00:00',
        end_time: '23:59',
        grace_period_minutes: 30,
        is_active: true,
        updated_by: adminUser.id,
      },
    });

    // Ensure student is currently INSIDE
    await prisma.student.update({
      where: { id: studentRecord.id },
      data: { current_state: 'INSIDE' },
    });

    // Scan EXIT
    const qr = await generateQrToken(gateDevice.id);
    const scanRes = await request(app)
      .post('/api/attendance/scan')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ token: qr.token });

    assert.strictEqual(scanRes.status, 200, 'Scan endpoint must succeed continuously without interruption');
    assert.strictEqual(scanRes.body.direction, 'EXIT');
    assert.strictEqual(scanRes.body.student_state, 'OUTSIDE');

    // Verify state_since was updated in database
    const updatedStudent = await prisma.student.findUnique({
      where: { id: studentRecord.id },
    });
    assert.ok(updatedStudent.state_since, 'state_since must be populated');

    // Verify an EXIT_DURING_CURFEW alert was raised immediately in the same transaction
    const alert = await prisma.curfewAlert.findFirst({
      where: {
        student_id: studentRecord.id,
        alert_type: 'EXIT_DURING_CURFEW',
        status: 'OPEN',
      },
      orderBy: { triggered_at: 'desc' },
    });

    assert.ok(alert, 'EXIT_DURING_CURFEW alert must be created immediately');
    assert.strictEqual(alert.status, 'OPEN');

    // Clean up this test window
    await prisma.curfewWindow.delete({ where: { id: window.id } });
  });

  test('12.3 Authorized Exit: Exit during curfew WITH approved leave request does NOT raise curfew alert', async () => {
    const window = await prisma.curfewWindow.create({
      data: {
        hostel_id: studentRecord.hostel_id,
        day_type: 'EVERYDAY',
        start_time: '00:00',
        end_time: '23:59',
        grace_period_minutes: 30,
        is_active: true,
        updated_by: adminUser.id,
      },
    });

    // Clear prior alerts
    await prisma.curfewAlert.deleteMany({ where: { student_id: studentRecord.id } });

    // Ensure student is INSIDE
    await prisma.student.update({
      where: { id: studentRecord.id },
      data: { current_state: 'INSIDE' },
    });

    // Create an APPROVED covering leave request for today
    const now = new Date();
    await prisma.leaveRequest.create({
      data: {
        student_id: studentRecord.id,
        hostel_id: studentRecord.hostel_id,
        requested_from: new Date(now.getTime() - 2 * 60 * 60 * 1000), // 2 hours ago
        requested_to: new Date(now.getTime() + 24 * 60 * 60 * 1000), // tomorrow
        reason: 'Authorized emergency leave to visit family',
        status: 'APPROVED',
        decided_by: adminUser.id,
        decided_at: new Date(),
      },
    });

    // Scan EXIT
    const qr = await generateQrToken(gateDevice.id);
    const scanRes = await request(app)
      .post('/api/attendance/scan')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ token: qr.token });

    assert.strictEqual(scanRes.status, 200);
    assert.strictEqual(scanRes.body.direction, 'EXIT');

    // Verify NO alert was raised
    const alert = await prisma.curfewAlert.findFirst({
      where: {
        student_id: studentRecord.id,
        status: 'OPEN',
      },
    });
    assert.strictEqual(alert, null, 'No alert should be raised when covering leave is approved');

    // Cleanup
    await prisma.leaveRequest.deleteMany({ where: { student_id: studentRecord.id } });
    await prisma.curfewWindow.delete({ where: { id: window.id } });
  });

  test('12.4 Job A Curfew-Start Sweep: Raises OVERNIGHT_NOT_RETURNED alert after grace period when OUTSIDE without leave', async () => {
    // Student is OUTSIDE without leave
    await prisma.student.update({
      where: { id: studentRecord.id },
      data: { current_state: 'OUTSIDE' },
    });
    await prisma.curfewAlert.deleteMany({ where: { student_id: studentRecord.id } });
    await prisma.leaveRequest.deleteMany({ where: { student_id: studentRecord.id } });

    const sweepWindow = {
      id: 'sweep-test-win',
      hostel_id: studentRecord.hostel_id,
      day_type: 'EVERYDAY',
      start_time: '21:00',
      end_time: '06:00',
      grace_period_minutes: 0, // test immediate recheck
      is_active: true,
    };

    // Trigger sweep with skipDelay=true
    const result = await triggerCurfewSweep({
      hostelId: studentRecord.hostel_id,
      window: sweepWindow,
      skipDelay: true,
    });

    assert.ok(result.alertsCreated && result.alertsCreated.length > 0, 'Sweep should create overnight alert');
    const createdAlert = result.alertsCreated.find((a) => a.student_id === studentRecord.id);
    assert.ok(createdAlert, 'Student must have an alert created');
    assert.strictEqual(createdAlert.alert_type, 'OVERNIGHT_NOT_RETURNED');
    assert.strictEqual(createdAlert.status, 'OPEN');
  });

  test('12.4 Job A Curfew-Start Sweep: Does NOT raise alert when OUTSIDE with covering approved leave', async () => {
    await prisma.student.update({
      where: { id: studentRecord.id },
      data: { current_state: 'OUTSIDE' },
    });
    await prisma.curfewAlert.deleteMany({ where: { student_id: studentRecord.id } });

    const now = new Date();
    await prisma.leaveRequest.create({
      data: {
        student_id: studentRecord.id,
        hostel_id: studentRecord.hostel_id,
        requested_from: new Date(now.getTime() - 1000 * 60 * 60),
        requested_to: new Date(now.getTime() + 1000 * 60 * 60 * 12),
        reason: 'Authorized out-pass',
        status: 'APPROVED',
        decided_by: adminUser.id,
        decided_at: new Date(),
      },
    });

    const sweepWindow = {
      id: 'sweep-test-win-2',
      hostel_id: studentRecord.hostel_id,
      day_type: 'EVERYDAY',
      start_time: '21:00',
      end_time: '06:00',
      grace_period_minutes: 0,
      is_active: true,
    };

    const result = await triggerCurfewSweep({
      hostelId: studentRecord.hostel_id,
      window: sweepWindow,
      skipDelay: true,
    });

    assert.strictEqual(result.initialCount, 0, 'Students with approved leave should be excluded from sweep');

    // Cleanup
    await prisma.leaveRequest.deleteMany({ where: { student_id: studentRecord.id } });
  });

  test('12.5 Leave Request Workflow: Submit (PENDING), Approve (APPROVED), Cancel (CANCELLED)', async () => {
    // 1. Student submits leave request
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const dayAfter = new Date(Date.now() + 48 * 60 * 60 * 1000);

    const submitRes = await request(app)
      .post('/api/curfew/leave-requests')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        requested_from: tomorrow.toISOString(),
        requested_to: dayAfter.toISOString(),
        reason: 'Attending hackathon in Delhi',
      });

    assert.strictEqual(submitRes.status, 201);
    assert.strictEqual(submitRes.body.leave_request.status, 'PENDING');
    const requestId = submitRes.body.leave_request.id;

    // 2. Warden approves request
    const approveRes = await request(app)
      .patch(`/api/curfew/leave-requests/${requestId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'APPROVED' });

    assert.strictEqual(approveRes.status, 200);
    assert.strictEqual(approveRes.body.leave_request.status, 'APPROVED');

    // 3. Student cancels the approved request before requested_from begins
    const cancelRes = await request(app)
      .patch(`/api/curfew/leave-requests/${requestId}/cancel`)
      .set('Authorization', `Bearer ${studentToken}`);

    assert.strictEqual(cancelRes.status, 200);
    assert.strictEqual(cancelRes.body.leave_request.status, 'CANCELLED');

    // Verify it is CANCELLED in DB
    const finalRequest = await prisma.leaveRequest.findUnique({
      where: { id: requestId },
    });
    assert.strictEqual(finalRequest.status, 'CANCELLED', 'Cancelled request must flip back to CANCELLED');
  });

  test('12.6 Alert Resolution: Resolve alert requires resolution_note and writes audit log', async () => {
    // Create an open alert
    const alert = await prisma.curfewAlert.create({
      data: {
        student_id: studentRecord.id,
        hostel_id: studentRecord.hostel_id,
        alert_type: 'OVERNIGHT_NOT_RETURNED',
        status: 'OPEN',
      },
    });

    // Attempt resolve without resolution_note -> 400
    const failRes = await request(app)
      .patch(`/api/curfew/alerts/${alert.id}/resolve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'RESOLVED' });

    assert.strictEqual(failRes.status, 400, 'Resolution note is strictly required');

    // Successful resolve with note
    const resolveRes = await request(app)
      .patch(`/api/curfew/alerts/${alert.id}/resolve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'RESOLVED',
        resolution_note: 'Student contacted security desk; verified returned via north side.',
      });

    assert.strictEqual(resolveRes.status, 200);
    assert.strictEqual(resolveRes.body.alert.status, 'RESOLVED');
    assert.strictEqual(resolveRes.body.alert.resolution_note, 'Student contacted security desk; verified returned via north side.');

    // Check audit log
    const audit = await prisma.auditLog.findFirst({
      where: {
        target_id: alert.id,
        action: 'CURFEW_ALERT_RESOLVED',
      },
    });
    assert.ok(audit, 'Audit log must be recorded for alert resolution');
  });

  test('12.7 Advisory Device Presence Signals: Ingestion and Presence Hint only for students INSIDE', async () => {
    // 1. Ingest simulated CONNECTED event
    const ingestRes = await request(app)
      .post('/api/curfew/presence-signals')
      .send({
        student_id: studentRecord.id,
        event_type: 'CONNECTED',
        hostel_id: studentRecord.hostel_id,
      });

    assert.strictEqual(ingestRes.status, 201);
    assert.strictEqual(ingestRes.body.signal.event_type, 'CONNECTED');

    // 2. Set student current_state to INSIDE and query presence hint
    await prisma.student.update({
      where: { id: studentRecord.id },
      data: { current_state: 'INSIDE' },
    });

    const hintInsideRes = await request(app)
      .get(`/api/curfew/presence-hint/${studentRecord.id}`)
      .set('Authorization', `Bearer ${studentToken}`);

    assert.strictEqual(hintInsideRes.status, 200);
    assert.strictEqual(hintInsideRes.body.inside, true);
    assert.ok(hintInsideRes.body.hint.includes('Last seen on hostel WiFi'));

    // 3. Set student current_state to OUTSIDE and query presence hint
    await prisma.student.update({
      where: { id: studentRecord.id },
      data: { current_state: 'OUTSIDE' },
    });

    const hintOutsideRes = await request(app)
      .get(`/api/curfew/presence-hint/${studentRecord.id}`)
      .set('Authorization', `Bearer ${studentToken}`);

    assert.strictEqual(hintOutsideRes.status, 200);
    assert.strictEqual(hintOutsideRes.body.inside, false);
    assert.strictEqual(hintOutsideRes.body.hint, null, 'WiFi hint must NOT be displayed when student is OUTSIDE');
  });

  test('12.8 Super Admin: Curfew Windows CRUD API endpoints', async () => {
    // 1. Create curfew window
    const createRes = await request(app)
      .post('/api/curfew/windows')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        hostel_id: studentRecord.hostel_id,
        day_type: 'WEEKEND',
        start_time: '22:30',
        end_time: '06:00',
        grace_period_minutes: 45,
        is_active: true,
      });

    assert.strictEqual(createRes.status, 201);
    const winId = createRes.body.window.id;

    // 2. Update window
    const updateRes = await request(app)
      .patch(`/api/curfew/windows/${winId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ grace_period_minutes: 60 });

    assert.strictEqual(updateRes.status, 200);
    assert.strictEqual(updateRes.body.window.grace_period_minutes, 60);

    // 3. List windows
    const listRes = await request(app)
      .get('/api/curfew/windows')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(listRes.status, 200);
    assert.ok(listRes.body.windows.some((w) => w.id === winId));

    // 4. Delete window
    const delRes = await request(app)
      .delete(`/api/curfew/windows/${winId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(delRes.status, 200);
  });
});
