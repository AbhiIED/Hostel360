import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { app } from '../src/index.js';
import prisma from '../src/prisma.js';
import { generateAccessToken, generateRefreshToken, hashToken } from '../src/utils/token.js';

describe('Phase 15: Staff Provisioning System', () => {
  let superAdminUser;
  let superAdminToken;

  let boysWardenUser;
  let boysWardenToken;

  let girlsWardenUser;
  let girlsWardenToken;

  let hostelH1;
  let hostelH5;
  let hostelH7;
  let mess1;

  before(async () => {
    superAdminUser = await prisma.user.findUnique({ where: { email: 'admin@hostel360.com' } });
    superAdminToken = generateAccessToken(superAdminUser);

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

    hostelH1 = await prisma.hostel.findUnique({ where: { code: 'H1' } });
    hostelH5 = await prisma.hostel.findUnique({ where: { code: 'H5' } });
    hostelH7 = await prisma.hostel.findUnique({ where: { code: 'H7' } });
    mess1 = await prisma.mess.findFirst();
  });

  after(async () => {
    // Clean up test records
    await prisma.staffInvite.deleteMany({
      where: { email: { contains: 'test.provision' } },
    });
    await prisma.staffNomination.deleteMany({
      where: { email: { contains: 'test.provision' } },
    });
    await prisma.staffHostelAssignment.deleteMany({
      where: { user: { email: { contains: 'test.provision' } } },
    });
    await prisma.staffMessAssignment.deleteMany({
      where: { user: { email: { contains: 'test.provision' } } },
    });
    await prisma.user.deleteMany({
      where: { email: { contains: 'test.provision' } },
    });
  });

  test('Checklist 1: A Warden cannot nominate staff for a hostel they are not assigned to (Server-side rejection 403)', async () => {
    // girlsWarden is assigned to H7 and H12, NOT H1
    const res = await request(app)
      .post('/api/staff/nominations')
      .set('Authorization', `Bearer ${girlsWardenToken}`)
      .send({
        name: 'Unassigned Nominee',
        email: 'test.provision.unassigned@hostel360.com',
        employee_id: 'EMP-UNASSIGNED-1',
        role: 'CARETAKER',
        hostel_id: hostelH1.id, // H1 is a boys hostel!
      });

    assert.strictEqual(res.status, 403, 'Should reject with 403 Forbidden');
    assert.match(res.body.error, /only nominate staff for their own currently assigned hostel/i);
  });

  test('Checklist 1.b: A Warden CAN nominate staff for their own assigned hostel', async () => {
    // boysWarden is assigned to H1
    const res = await request(app)
      .post('/api/staff/nominations')
      .set('Authorization', `Bearer ${boysWardenToken}`)
      .send({
        name: 'Valid Caretaker Nominee',
        email: 'test.provision.validcaretaker@hostel360.com',
        phone: '+91 9876543210',
        employee_id: 'EMP-CT-001',
        role: 'CARETAKER',
        hostel_id: hostelH1.id,
      });

    assert.strictEqual(res.status, 201, 'Should create nomination with 201');
    assert.strictEqual(res.body.nomination.status, 'PENDING');
    assert.strictEqual(res.body.nomination.role, 'CARETAKER');
  });

  test('Checklist 2: Nominee has zero access until invite is accepted (no assignment row, cannot log in)', async () => {
    const nomineeEmail = 'test.provision.validcaretaker@hostel360.com';

    // 1. Confirm no user or assignments exist before Super Admin approval and invite acceptance
    const userBefore = await prisma.user.findUnique({ where: { email: nomineeEmail } });
    assert.strictEqual(userBefore, null, 'User must not exist yet');

    const assignmentBefore = await prisma.staffHostelAssignment.findFirst({
      where: { user: { email: nomineeEmail } },
    });
    assert.strictEqual(assignmentBefore, null, 'No staff_hostel_assignments row must exist before acceptance');

    // 2. Attempt login should fail
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: nomineeEmail, password: 'Password123!' });

    assert.strictEqual(loginRes.status, 401, 'Login must fail');
  });

  test('Checklist 3: Expired invite cannot be accepted; Super Admin can regenerate fresh one', async () => {
    // 1. Super Admin approves nomination to generate invite
    const nomination = await prisma.staffNomination.findFirst({
      where: { email: 'test.provision.validcaretaker@hostel360.com' },
    });
    assert.ok(nomination, 'Nomination must exist');

    const approveRes = await request(app)
      .post(`/api/staff/nominations/${nomination.id}/approve`)
      .set('Authorization', `Bearer ${superAdminToken}`);

    assert.strictEqual(approveRes.status, 200);
    const initialToken = approveRes.body.token;
    const inviteId = approveRes.body.invite.id;
    assert.ok(initialToken, 'Token must be returned');

    // 2. Artificially expire the invite in the database
    await prisma.staffInvite.update({
      where: { id: inviteId },
      data: { expires_at: new Date(Date.now() - 1000 * 60 * 60) }, // 1 hour in the past
    });

    // 3. Attempting to accept expired invite should fail with 400
    const acceptExpiredRes = await request(app)
      .post('/api/staff/invites/accept')
      .send({
        token: initialToken,
        password: 'SecurePassword123!',
      });

    assert.strictEqual(acceptExpiredRes.status, 400);
    assert.match(acceptExpiredRes.body.error, /expired/i);

    // 4. Super Admin regenerates the invite
    const regenRes = await request(app)
      .post(`/api/staff/invites/${inviteId}/regenerate`)
      .set('Authorization', `Bearer ${superAdminToken}`);

    assert.strictEqual(regenRes.status, 200);
    const freshToken = regenRes.body.token;
    assert.notStrictEqual(freshToken, initialToken, 'Fresh token must differ from old expired token');

    // 5. Old token is now invalid
    const acceptOldRes = await request(app)
      .post('/api/staff/invites/accept')
      .send({
        token: initialToken,
        password: 'SecurePassword123!',
      });
    assert.strictEqual(acceptOldRes.status, 404, 'Old token must be rejected as invalid');

    // 6. Fresh token works and activates the account!
    const acceptFreshRes = await request(app)
      .post('/api/staff/invites/accept')
      .send({
        token: freshToken,
        password: 'FreshPassword123!',
      });

    assert.strictEqual(acceptFreshRes.status, 200, 'Accepting fresh token should succeed');
    assert.strictEqual(acceptFreshRes.body.user.email, 'test.provision.validcaretaker@hostel360.com');

    // 7. Verify assignment row now exists in database
    const createdAssignment = await prisma.staffHostelAssignment.findFirst({
      where: { user: { email: 'test.provision.validcaretaker@hostel360.com' } },
    });
    assert.ok(createdAssignment, 'StaffHostelAssignment must now exist');
    assert.strictEqual(createdAssignment.role, 'CARETAKER');
    assert.strictEqual(createdAssignment.hostel_id, hostelH1.id);
  });

  test('Checklist 4: Ending an assignment immediately revokes that user refresh tokens (Stops refresh token access)', async () => {
    const caretakerEmail = 'test.provision.validcaretaker@hostel360.com';

    // 1. Caretaker logs in to receive access & refresh token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: caretakerEmail,
        password: 'FreshPassword123!',
      });

    assert.strictEqual(loginRes.status, 200);
    const { accessToken, refreshToken } = loginRes.body;
    assert.ok(refreshToken, 'Refresh token must be returned');

    // 2. Verify refresh token works before offboarding
    const refreshBeforeRes = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken });

    assert.strictEqual(refreshBeforeRes.status, 200, 'Refresh token works before offboarding');
    const newRefreshToken = refreshBeforeRes.body.refreshToken;

    // 3. Find the caretaker hostel assignment
    const assignment = await prisma.staffHostelAssignment.findFirst({
      where: { user: { email: caretakerEmail }, end_date: null },
    });
    assert.ok(assignment, 'Active assignment found');

    // 4. Warden ends the caretaker assignment directly
    const endRes = await request(app)
      .post(`/api/staff/assignments/hostel/${assignment.id}/end`)
      .set('Authorization', `Bearer ${boysWardenToken}`)
      .send({ end_reason: 'Resigned from position' });

    assert.strictEqual(endRes.status, 200, 'Warden ends assignment directly');

    // 5. Verify refresh token is immediately rejected (401)
    const refreshAfterRes = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: newRefreshToken });

    assert.strictEqual(refreshAfterRes.status, 401, 'Refresh token must be revoked and rejected');

    // 6. Verify subsequent login attempt is blocked because user has 0 active assignments
    const loginAfterRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: caretakerEmail,
        password: 'FreshPassword123!',
      });

    assert.strictEqual(loginAfterRes.status, 403, 'Login blocked when user has 0 active assignments');
    assert.strictEqual(loginAfterRes.body.code, 'NO_ACTIVE_ASSIGNMENT');
  });

  test('Checklist 5: Scoped Offboarding: Warden CANNOT end another hostel assignment, or a Warden assignment', async () => {
    // 1. Create a Caretaker in H5 (where boysWarden is NOT assigned)
    const h5CaretakerUser = await prisma.user.create({
      data: {
        name: 'H5 Caretaker Test',
        email: 'test.provision.h5ct@hostel360.com',
        password_hash: await bcrypt.hash('Password123!', 10),
        role: 'CARETAKER',
        employee_id: 'EMP-H5-CT',
      },
    });

    const h5Assignment = await prisma.staffHostelAssignment.create({
      data: {
        user_id: h5CaretakerUser.id,
        hostel_id: hostelH5.id,
        role: 'CARETAKER',
      },
    });

    // 2. boysWarden attempts to end H5 Caretaker assignment -> MUST be rejected (403)
    const wardenH5EndRes = await request(app)
      .post(`/api/staff/assignments/hostel/${h5Assignment.id}/end`)
      .set('Authorization', `Bearer ${boysWardenToken}`)
      .send({ end_reason: 'Unauthorized attempt' });

    assert.strictEqual(wardenH5EndRes.status, 403, 'Warden cannot end another hostel assignment');

    // 3. boysWarden attempts to end a WARDEN assignment (including their own) -> MUST be rejected (403)
    const wardenOwnAssignment = await prisma.staffHostelAssignment.findFirst({
      where: { user_id: boysWardenUser.id, role: 'WARDEN', end_date: null },
    });

    const wardenSelfEndRes = await request(app)
      .post(`/api/staff/assignments/hostel/${wardenOwnAssignment.id}/end`)
      .set('Authorization', `Bearer ${boysWardenToken}`)
      .send({ end_reason: 'Self removal attempt' });

    assert.strictEqual(wardenSelfEndRes.status, 403, 'Warden cannot end a Warden assignment');
    assert.match(wardenSelfEndRes.body.error, /cannot end a Warden assignment/i);

    // 4. Super Admin CAN end any assignment
    const superAdminEndRes = await request(app)
      .post(`/api/staff/assignments/hostel/${h5Assignment.id}/end`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ end_reason: 'Super Admin administrative termination' });

    assert.strictEqual(superAdminEndRes.status, 200, 'Super Admin can end any assignment');
  });

  test('Checklist 6: Two concurrent active Caretaker assignments for the same hostel are allowed', async () => {
    // 1. Create Caretaker A
    const ctA = await prisma.user.create({
      data: {
        name: 'Concurrent Caretaker A',
        email: 'test.provision.cta@hostel360.com',
        password_hash: await bcrypt.hash('Password123!', 10),
        role: 'CARETAKER',
        employee_id: 'EMP-CTA',
      },
    });

    const assignA = await prisma.staffHostelAssignment.create({
      data: {
        user_id: ctA.id,
        hostel_id: hostelH1.id,
        role: 'CARETAKER',
        is_primary: true,
      },
    });
    assert.ok(assignA.id);

    // 2. Create Caretaker B for the exact same hostel H1 concurrently
    const ctB = await prisma.user.create({
      data: {
        name: 'Concurrent Caretaker B',
        email: 'test.provision.ctb@hostel360.com',
        password_hash: await bcrypt.hash('Password123!', 10),
        role: 'CARETAKER',
        employee_id: 'EMP-CTB',
      },
    });

    const assignB = await prisma.staffHostelAssignment.create({
      data: {
        user_id: ctB.id,
        hostel_id: hostelH1.id,
        role: 'CARETAKER',
        is_primary: false,
      },
    });
    assert.ok(assignB.id, 'Second caretaker assignment on H1 must succeed without collision');

    // 3. Verify both exist concurrently active in database
    const activeCaretakersH1 = await prisma.staffHostelAssignment.findMany({
      where: {
        hostel_id: hostelH1.id,
        role: 'CARETAKER',
        end_date: null,
      },
    });

    const activeEmails = activeCaretakersH1.map((a) => a.user_id);
    assert.ok(activeEmails.includes(ctA.id), 'Caretaker A is active in H1');
    assert.ok(activeEmails.includes(ctB.id), 'Caretaker B is active in H1');
    assert.ok(activeCaretakersH1.length >= 2, 'At least two concurrent active caretakers exist for H1');
  });

  test('Direct Provisioning: Super Admin can provision Mess Admin and Warden directly', async () => {
    if (!mess1) return;

    // 1. Super Admin invites Mess Admin
    const inviteRes = await request(app)
      .post('/api/staff/invites')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        name: 'Central Mess Manager',
        email: 'test.provision.messmgr@hostel360.com',
        employee_id: 'EMP-MESS-01',
        role: 'MESS_ADMIN',
        target_mess_ids: [mess1.id],
      });

    assert.strictEqual(inviteRes.status, 201);
    const token = inviteRes.body.token;
    assert.ok(token);

    // 2. Mess Admin accepts invite
    const acceptRes = await request(app)
      .post('/api/staff/invites/accept')
      .send({
        token,
        password: 'MessManagerPassword123!',
      });

    assert.strictEqual(acceptRes.status, 200);
    assert.strictEqual(acceptRes.body.user.role, 'MESS_ADMIN');

    // 3. Verify active staff mess assignment created
    const messAssignment = await prisma.staffMessAssignment.findFirst({
      where: { user: { email: 'test.provision.messmgr@hostel360.com' } },
    });
    assert.ok(messAssignment, 'StaffMessAssignment exists');
    assert.strictEqual(messAssignment.mess_id, mess1.id);
  });
});
