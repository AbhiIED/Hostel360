import { test, describe } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { app } from '../src/index.js';
import { generateQrToken } from '../src/services/qrTokenService.js';
import prisma from '../src/prisma.js';

describe('Scan Endpoint Tests (11.4)', () => {
  async function getStudentAuth() {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'aarav.sharma@student.hostel360.com',
        password: 'password123',
      });
    return {
      token: loginRes.body.accessToken,
      user: loginRes.body.user,
    };
  }

  async function getStudentGateDevice(studentHostelId) {
    let dev = await prisma.device.findFirst({
      where: {
        purpose: 'GATE',
        is_active: true,
        gate: { hostel_id: studentHostelId },
      },
    });

    if (!dev) {
      const gate = await prisma.gate.findFirst({ where: { hostel_id: studentHostelId } });
      assert.ok(gate, 'Gate must exist in student hostel');
      const adminUser = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
      dev = await prisma.device.create({
        data: {
          device_name: `${gate.name} Kiosk`,
          device_code: `H1_GATE_TEST_${Date.now().toString().slice(-4)}`,
          purpose: 'GATE',
          gate_id: gate.id,
          is_active: true,
          secret_hash: 'dummy',
          registered_by: adminUser.id,
        },
      });
    }

    assert.ok(dev, 'Active gate device required for student hostel');
    return dev;
  }

  test('POST /api/attendance/scan rejects unauthorized requests without Bearer token', async () => {
    const res = await request(app)
      .post('/api/attendance/scan')
      .send({ token: 'dummy' });

    assert.strictEqual(res.status, 401);
  });

  test('POST /api/attendance/scan with valid QR records gate attendance and flips current_state', async () => {
    const { token: studentToken, user: studentUser } = await getStudentAuth();

    // Fetch student's assigned hostel
    const studentBefore = await prisma.student.findUnique({
      where: { user_id: studentUser.id },
    });
    assert.ok(studentBefore, 'Student must exist');

    const gateDevice = await getStudentGateDevice(studentBefore.hostel_id);

    // Generate valid QR token for this student's hostel gate kiosk
    const qr = await generateQrToken(gateDevice.id);

    const initialState = studentBefore.current_state;
    const expectedDirection = initialState === 'INSIDE' ? 'EXIT' : 'ENTRY';
    const expectedNewState = initialState === 'INSIDE' ? 'OUTSIDE' : 'INSIDE';

    const scanRes = await request(app)
      .post('/api/attendance/scan')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ token: qr.token });

    assert.strictEqual(scanRes.status, 200);
    assert.strictEqual(scanRes.body.direction, expectedDirection);
    assert.strictEqual(scanRes.body.student_state, expectedNewState);
    assert.ok(scanRes.body.attendance);

    // Verify DB updated
    const studentAfter = await prisma.student.findUnique({
      where: { user_id: studentUser.id },
    });
    assert.strictEqual(studentAfter.current_state, expectedNewState);
  });

  test('GET /api/attendance/self returns self history for authenticated student', async () => {
    const { token: studentToken } = await getStudentAuth();

    const res = await request(app)
      .get('/api/attendance/self')
      .set('Authorization', `Bearer ${studentToken}`);

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.student);
    assert.ok(Array.isArray(res.body.hostel_logs));
    assert.ok(Array.isArray(res.body.mess_logs));
  });
});
