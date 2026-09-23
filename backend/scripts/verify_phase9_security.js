import prisma from '../src/prisma.js';

const BASE_URL = 'http://localhost:5000/api';

async function req(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  let data = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = await res.json();
    } catch (e) {
      data = null;
    }
  } else {
    data = await res.text();
  }

  return {
    status: res.status,
    headers: res.headers,
    data,
  };
}

async function testSecurityHardening() {
  console.log('🛡️  Starting Phase 9 Security Hardening Verification Suite...\n');
  let passed = 0;
  let total = 0;

  function assert(condition, testName) {
    total++;
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${testName}`);
    }
  }

  try {
    // -------------------------------------------------------------
    // Test 1: Input Validation Hardening (9.6)
    // -------------------------------------------------------------
    console.log('--- 9.6 Input Validation Hardening ---');
    const badLoginRes = await req(`${BASE_URL}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ email: 'not-an-email', password: '' }),
    });
    assert(
      badLoginRes.status === 400 && badLoginRes.data?.details?.email,
      'Malformed email & empty password rejected with 400 Zod error'
    );

    const badRefreshRes = await req(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    assert(
      badRefreshRes.status === 400,
      'Empty refresh payload rejected with 400'
    );

    // -------------------------------------------------------------
    // Test 2: RBAC Edge Cases (9.5)
    // -------------------------------------------------------------
    console.log('\n--- 9.5 RBAC Edge Cases ---');
    // Login as student
    const studentLogin = await req(`${BASE_URL}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({
        email: 'aarav.sharma@student.hostel360.com',
        password: 'password123',
      }),
    });
    const studentToken = studentLogin.data.accessToken;
    const studentRefreshToken = studentLogin.data.refreshToken;

    // Student trying to register device (requires SUPER_ADMIN)
    const devRegStudent = await req(`${BASE_URL}/devices/register`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({ device_name: 'Hacker Kiosk', purpose: 'GATE' }),
    });
    assert(
      devRegStudent.status === 403,
      'Student blocked with 403 Forbidden on POST /api/devices/register'
    );

    // Student trying to create hostel (requires SUPER_ADMIN)
    const hostelStudent = await req(`${BASE_URL}/hostels`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({
        code: 'H99',
        name: 'Rogue Hostel',
        type: 'BOYS',
        location: 'Nowhere',
        total_capacity: 100,
      }),
    });
    assert(
      hostelStudent.status === 403,
      'Student blocked with 403 Forbidden on POST /api/hostels'
    );

    // Warden trying to create hostel (requires SUPER_ADMIN)
    const wardenLogin = await req(`${BASE_URL}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({
        email: 'warden.boys@hostel360.com',
        password: 'password123',
      }),
    });
    const wardenToken = wardenLogin.data.accessToken;

    const hostelWarden = await req(`${BASE_URL}/hostels`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${wardenToken}` },
      body: JSON.stringify({
        code: 'H98',
        name: 'Warden Rogue Hostel',
        type: 'BOYS',
        location: 'Nowhere',
        total_capacity: 100,
      }),
    });
    assert(
      hostelWarden.status === 403,
      'Warden blocked with 403 Forbidden on POST /api/hostels'
    );

    // -------------------------------------------------------------
    // Test 3: Refresh Token Reuse Detection (9.1)
    // -------------------------------------------------------------
    console.log('\n--- 9.1 Refresh Token Reuse Detection ---');
    // Rotate token: R1 -> R2
    const refreshRes1 = await req(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      body: JSON.stringify({ refreshToken: studentRefreshToken }),
    });
    const newRefreshToken = refreshRes1.data.refreshToken;
    assert(
      refreshRes1.status === 200 && !!newRefreshToken,
      'Initial token rotation successful (R1 -> R2)'
    );

    // Attempt reuse of revoked token R1
    const reuseRes = await req(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      body: JSON.stringify({ refreshToken: studentRefreshToken }),
    });
    assert(
      reuseRes.status === 401 && reuseRes.data?.error?.includes('reuse detected'),
      'Revoked token R1 reuse detected and rejected with 401 breach alert'
    );

    // Attempt to use R2 after breach detection: should also be revoked because all sessions are revoked!
    const r2AfterBreach = await req(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      body: JSON.stringify({ refreshToken: newRefreshToken }),
    });
    assert(
      r2AfterBreach.status === 401,
      'Subsequent token R2 successfully invalidated due to all-session revocation'
    );

    // Check breach audit log
    const breachAudit = await prisma.auditLog.findFirst({
      where: { action: 'SECURITY_ALERT_REFRESH_TOKEN_REUSE' },
      orderBy: { created_at: 'desc' },
    });
    assert(!!breachAudit, 'Security alert audit log recorded for token reuse');

    // -------------------------------------------------------------
    // Test 4: Device Revocation Instant Verification (9.3)
    // -------------------------------------------------------------
    console.log('\n--- 9.3 Device Revocation Instant Check ---');
    // Login as Super Admin
    const adminLogin = await req(`${BASE_URL}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({
        email: 'admin@hostel360.com',
        password: 'password123',
      }),
    });
    const adminToken = adminLogin.data.accessToken;

    // Register a test kiosk device
    const existingGate = await prisma.gate.findFirst();
    const testDeviceCode = `TEST-DEV-${Date.now().toString().slice(-4)}`;
    const regRes = await req(`${BASE_URL}/devices/register`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        device_code: testDeviceCode,
        device_name: 'Temporary Security Test Kiosk',
        purpose: 'GATE',
        gate_id: existingGate.id,
      }),
    });
    const testDevice = regRes.data.device;
    const testSecret = regRes.data.secret;

    // Heartbeat before disable should succeed
    const hbRes = await req(`${BASE_URL}/devices/heartbeat`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${testSecret}`,
        'x-device-id': testDevice.id,
      },
    });
    assert(hbRes.status === 200, 'Active device authenticates and sends heartbeat');

    // Disable device via admin endpoint
    const disableRes = await req(`${BASE_URL}/devices/${testDevice.id}/disable`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(
      disableRes.status === 200 && disableRes.data?.device?.is_active === false,
      'Device successfully disabled by admin'
    );

    // Immediately try heartbeat again: must fail instantly with 401
    const hbAfterDisable = await req(`${BASE_URL}/devices/heartbeat`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${testSecret}`,
        'x-device-id': testDevice.id,
      },
    });
    assert(
      hbAfterDisable.status === 401,
      'Disabled device instantly rejected with 401 on next request'
    );

    // -------------------------------------------------------------
    // Test 5: Scan Rate Limiter (9.2)
    // -------------------------------------------------------------
    console.log('\n--- 9.2 Scan Rate Limiting (5 req/min per student) ---');
    // Fresh student login
    const freshStudent = await req(`${BASE_URL}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({
        email: 'aarav.sharma@student.hostel360.com',
        password: 'password123',
      }),
    });
    const freshToken = freshStudent.data.accessToken;

    let rateLimitHit = false;
    let rateLimitHeaderPresent = false;
    // Send 7 rapid requests to /api/attendance/scan
    for (let i = 1; i <= 7; i++) {
      const scanRes = await req(`${BASE_URL}/attendance/scan`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${freshToken}` },
        body: JSON.stringify({ token: 'dummy-invalid-token' }),
      });
      if (scanRes.status === 429) {
        rateLimitHit = true;
        if (scanRes.headers.get('ratelimit-limit')) {
          rateLimitHeaderPresent = true;
        }
      }
    }
    assert(rateLimitHit, 'Scan rate limit triggers 429 RATE_LIMIT_EXCEEDED on > 5 requests');
    assert(rateLimitHeaderPresent, 'Standard RateLimit-* headers returned');

    // -------------------------------------------------------------
    // Test 6: Audit Log Completeness (9.4)
    // -------------------------------------------------------------
    console.log('\n--- 9.4 Audit Log Completeness Check ---');
    const auditCount = await prisma.auditLog.count();
    const distinctActions = await prisma.auditLog.findMany({
      select: { action: true },
      distinct: ['action'],
    });
    const actionList = distinctActions.map((a) => a.action);

    console.log(`  Total audit records in system: ${auditCount}`);
    console.log(`  Distinct recorded actions: ${actionList.join(', ')}`);

    assert(auditCount > 0, 'Audit log contains persisted security records');
    assert(
      actionList.includes('USER_LOGIN') && actionList.includes('DEVICE_DISABLED'),
      'Audit log tracks authentication and administrative security lifecycle events'
    );

    // -------------------------------------------------------------
    // Test 7: CORS and Helmet Hardening (9.7)
    // -------------------------------------------------------------
    console.log('\n--- 9.7 CORS and Helmet Hardening ---');
    const healthRes = await req(`${BASE_URL}/health`);
    const headers = healthRes.headers;

    assert(
      headers.get('x-content-type-options') === 'nosniff',
      'Helmet X-Content-Type-Options: nosniff header verified'
    );
    assert(
      !!headers.get('content-security-policy'),
      'Helmet Content-Security-Policy header verified'
    );
    assert(
      headers.get('cross-origin-resource-policy') === 'cross-origin',
      'Cross-Origin-Resource-Policy header verified'
    );

    console.log(`\n========================================`);
    console.log(`Phase 9 Security Results: ${passed}/${total} passed`);
    console.log(`========================================\n`);

    if (passed === total) {
      console.log('🎉 All Phase 9 Security Hardening criteria verified successfully!');
      process.exit(0);
    } else {
      console.error('❌ Some security tests failed.');
      process.exit(1);
    }
  } catch (error) {
    console.error('Test execution error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testSecurityHardening();
