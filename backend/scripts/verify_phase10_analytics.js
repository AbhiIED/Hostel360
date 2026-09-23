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

async function testAnalytics() {
  console.log('📊 Starting Phase 10 Analytics & Reports Verification Suite...\n');
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
    // Login as Super Admin
    const adminLogin = await req(`${BASE_URL}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@hostel360.com', password: 'password123' }),
    });
    const adminToken = adminLogin.data.accessToken;

    // Login as Warden
    const wardenLogin = await req(`${BASE_URL}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ email: 'warden.boys@hostel360.com', password: 'password123' }),
    });
    const wardenToken = wardenLogin.data.accessToken;

    // Login as Mess Admin
    const messLogin = await req(`${BASE_URL}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ email: 'messadmin@hostel360.com', password: 'password123' }),
    });
    const messToken = messLogin.data.accessToken;

    // -------------------------------------------------------------
    // Test 1: Occupancy History API (10.1)
    // -------------------------------------------------------------
    console.log('--- 10.1 Occupancy History API ---');
    const occRes = await req(`${BASE_URL}/analytics/occupancy-history?days=7`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(occRes.status === 200, 'Super admin fetches campus occupancy history');
    assert(Array.isArray(occRes.data?.timeline), 'Timeline array returned');
    assert(occRes.data?.timeline?.length === 7, 'Timeline has 7 daily buckets');
    assert(Array.isArray(occRes.data?.hourlyPeaks), 'Hourly peak distribution returned (24 slots)');
    assert(occRes.data?.hourlyPeaks?.length === 24, '24 hourly slots calculated');

    // Warden access test
    const wardenOccRes = await req(`${BASE_URL}/analytics/occupancy-history?days=7`, {
      headers: { Authorization: `Bearer ${wardenToken}` },
    });
    assert(wardenOccRes.status === 200, 'Warden fetches assigned hostel occupancy history');

    // -------------------------------------------------------------
    // Test 2: Meal Trends API (10.2)
    // -------------------------------------------------------------
    console.log('\n--- 10.2 Meal Trends API ---');
    const mealRes = await req(`${BASE_URL}/analytics/meal-trends?days=7`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(mealRes.status === 200, 'Super admin fetches campus meal trends');
    assert(Array.isArray(mealRes.data?.timeline), 'Meal timeline array returned');
    assert(mealRes.data?.summary?.mealTypeCounts !== undefined, 'Meal type counts (BREAKFAST, LUNCH, etc.) present');

    const messAdminMealRes = await req(`${BASE_URL}/analytics/meal-trends?days=7`, {
      headers: { Authorization: `Bearer ${messToken}` },
    });
    assert(messAdminMealRes.status === 200, 'Mess admin fetches scoped meal trends');

    // -------------------------------------------------------------
    // Test 3: Export API (10.3)
    // -------------------------------------------------------------
    console.log('\n--- 10.3 Export Reports API (CSV Streams) ---');
    const gateCsvRes = await req(`${BASE_URL}/analytics/export?type=hostel_attendance&days=30`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(gateCsvRes.status === 200, 'Gate attendance CSV generated successfully');
    assert(
      gateCsvRes.headers.get('content-type')?.includes('text/csv'),
      'Content-Type is text/csv'
    );
    assert(
      gateCsvRes.headers.get('content-disposition')?.includes('attachment; filename='),
      'Content-Disposition attachment filename header present'
    );
    assert(
      typeof gateCsvRes.data === 'string' && gateCsvRes.data.includes('Scanned At,Roll Number,Student Name'),
      'CSV header structure verified for gate attendance'
    );

    const messCsvRes = await req(`${BASE_URL}/analytics/export?type=mess_attendance&days=30`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(messCsvRes.status === 200, 'Mess attendance CSV generated successfully');
    assert(
      typeof messCsvRes.data === 'string' && messCsvRes.data.includes('Date,Scanned At,Roll Number'),
      'CSV header structure verified for mess attendance'
    );

    console.log(`\n========================================`);
    console.log(`Phase 10 Analytics Results: ${passed}/${total} passed`);
    console.log(`========================================\n`);

    if (passed === total) {
      console.log('🎉 All Phase 10 Analytics & Reports criteria verified successfully!');
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (error) {
    console.error('Test execution error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testAnalytics();
