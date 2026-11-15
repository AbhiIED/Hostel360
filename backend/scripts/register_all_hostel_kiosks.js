import crypto from 'crypto';
import bcrypt from 'bcrypt';
import prisma from '../src/prisma.js';

async function registerAllHostelKiosks() {
  console.log('🔄 Starting campus-wide registration of all Hostel Gate & Mess Kiosks (H1 to H12)...');

  // 1. Fetch Super Admin for registered_by
  let superAdmin = await prisma.user.findFirst({
    where: { role: 'SUPER_ADMIN' },
  });
  if (!superAdmin) {
    console.log('Super Admin user not found. Fresh database detected — running prisma/seed.js first...');
    const { execSync } = await import('child_process');
    execSync('node prisma/seed.js', { stdio: 'inherit' });
    superAdmin = await prisma.user.findFirst({
      where: { role: 'SUPER_ADMIN' },
    });
    if (!superAdmin) {
      throw new Error('Super Admin user not found even after seeding');
    }
  }

  // 2. Fetch all 12 hostels
  let hostels = await prisma.hostel.findMany({
    orderBy: { code: 'asc' },
    include: {
      gates: {
        include: {
          devices: true,
        },
      },
      messes: {
        include: {
          devices: true,
        },
      },
    },
  });

  if (hostels.length === 0) {
    console.log('No hostels found. Running prisma/seed.js first...');
    const { execSync } = await import('child_process');
    execSync('node prisma/seed.js', { stdio: 'inherit' });
    hostels = await prisma.hostel.findMany({
      orderBy: { code: 'asc' },
      include: {
        gates: { include: { devices: true } },
        messes: { include: { devices: true } },
      },
    });
  }

  console.log(`Found ${hostels.length} hostels.`);

  const seededSecrets = {};

  for (const hostel of hostels) {
    console.log(`\n🏢 Processing ${hostel.code} — ${hostel.name} (${hostel.type})...`);

    // --- A. Ensure Gates Exist ---
    let expectedGateNames = ['Main Gate', 'Side Gate'];
    if (hostel.code === 'H10') {
      expectedGateNames = ['Block A Gate', 'Block B Gate', 'Block C Gate', 'Block D Gate'];
    }

    const currentGates = await prisma.gate.findMany({
      where: { hostel_id: hostel.id },
      include: { devices: true },
    });

    for (const gateName of expectedGateNames) {
      let gate = currentGates.find((g) => g.name.toLowerCase() === gateName.toLowerCase());
      if (!gate) {
        gate = await prisma.gate.create({
          data: {
            hostel_id: hostel.id,
            name: gateName,
            is_active: true,
          },
          include: { devices: true },
        });
        console.log(`  + Created gate: ${gateName}`);
      }

      // Check if gate has an active device
      let activeDevice = gate.devices?.find((d) => d.is_active);
      if (!activeDevice) {
        // Derive clean device code: e.g. H1_GATE_MAIN, H10_GATE_BLOCK_A
        const suffix = gateName.toUpperCase().replace(/\s+/g, '_');
        const deviceCode = `${hostel.code}_GATE_${suffix}`;
        const deviceName = `${hostel.code} ${gateName} Display Kiosk`;

        const rawSecret = crypto.randomBytes(32).toString('hex');
        const salt = await bcrypt.genSalt(10);
        const secretHash = await bcrypt.hash(rawSecret, salt);

        activeDevice = await prisma.device.upsert({
          where: { device_code: deviceCode },
          update: {
            device_name: deviceName,
            purpose: 'GATE',
            gate_id: gate.id,
            mess_id: null,
            is_active: true,
          },
          create: {
            device_code: deviceCode,
            device_name: deviceName,
            purpose: 'GATE',
            gate_id: gate.id,
            mess_id: null,
            secret_hash: secretHash,
            is_active: true,
            registered_by: superAdmin.id,
          },
        });

        seededSecrets[activeDevice.id] = rawSecret;
        console.log(`  + Registered GATE kiosk: ${deviceCode} (Device ID: ${activeDevice.id})`);
      } else {
        console.log(`  ✓ Gate kiosk exists: ${activeDevice.device_code || activeDevice.device_name}`);
      }
    }

    // --- B. Ensure Hostel-Specific Mess & Meal Windows Exist ---
    const messName = `${hostel.code} Dining Hall (${hostel.name})`;
    let hostelMess = await prisma.mess.findFirst({
      where: {
        OR: [
          { hostel_id: hostel.id },
          { name: messName },
        ],
      },
      include: { devices: true },
    });

    if (!hostelMess) {
      hostelMess = await prisma.mess.create({
        data: {
          name: messName,
          hostel_id: hostel.id,
        },
        include: { devices: true },
      });
      console.log(`  + Created Mess: ${messName}`);
    } else if (!hostelMess.hostel_id) {
      hostelMess = await prisma.mess.update({
        where: { id: hostelMess.id },
        data: { hostel_id: hostel.id },
        include: { devices: true },
      });
    }

    // Ensure standard meal windows exist for this mess
    const standardMealWindows = [
      { meal_type: 'BREAKFAST', start_time: '07:30', end_time: '09:30' },
      { meal_type: 'LUNCH', start_time: '12:30', end_time: '14:30' },
      { meal_type: 'SNACKS', start_time: '17:00', end_time: '18:30' },
      { meal_type: 'DINNER', start_time: '20:00', end_time: '22:00' },
    ];

    for (const mw of standardMealWindows) {
      const existing = await prisma.mealWindow.findFirst({
        where: { mess_id: hostelMess.id, meal_type: mw.meal_type },
      });
      if (!existing) {
        await prisma.mealWindow.create({
          data: {
            mess_id: hostelMess.id,
            meal_type: mw.meal_type,
            start_time: mw.start_time,
            end_time: mw.end_time,
            is_active: true,
          },
        });
      }
    }

    // Ensure Mess Kiosk Device Exists
    let activeMessDevice = hostelMess.devices?.find((d) => d.is_active);
    if (!activeMessDevice) {
      const messDeviceCode = `${hostel.code}_MESS`;
      const messDeviceName = `${hostel.code} Dining Counter Kiosk`;

      const rawSecret = crypto.randomBytes(32).toString('hex');
      const salt = await bcrypt.genSalt(10);
      const secretHash = await bcrypt.hash(rawSecret, salt);

      activeMessDevice = await prisma.device.upsert({
        where: { device_code: messDeviceCode },
        update: {
          device_name: messDeviceName,
          purpose: 'MESS',
          gate_id: null,
          mess_id: hostelMess.id,
          is_active: true,
        },
        create: {
          device_code: messDeviceCode,
          device_name: messDeviceName,
          purpose: 'MESS',
          gate_id: null,
          mess_id: hostelMess.id,
          secret_hash: secretHash,
          is_active: true,
          registered_by: superAdmin.id,
        },
      });

      seededSecrets[activeMessDevice.id] = rawSecret;
      console.log(`  + Registered MESS kiosk: ${messDeviceCode} (Device ID: ${activeMessDevice.id})`);
    } else {
      console.log(`  ✓ Mess kiosk exists: ${activeMessDevice.device_code || activeMessDevice.device_name}`);
    }
  }

  // --- C. Verify Central Campus Mess ---
  const centralMess = await prisma.mess.findFirst({
    where: { name: 'MANIT Central Campus Mess' },
    include: { devices: true },
  });
  if (centralMess) {
    let centralDevice = centralMess.devices?.find((d) => d.is_active);
    if (!centralDevice) {
      const rawSecret = crypto.randomBytes(32).toString('hex');
      const salt = await bcrypt.genSalt(10);
      const secretHash = await bcrypt.hash(rawSecret, salt);
      centralDevice = await prisma.device.create({
        data: {
          device_code: 'CENTRAL_MESS',
          device_name: 'Central Campus Mess Kiosk',
          purpose: 'MESS',
          mess_id: centralMess.id,
          secret_hash: secretHash,
          is_active: true,
          registered_by: superAdmin.id,
        },
      });
      seededSecrets[centralDevice.id] = rawSecret;
      console.log(`\n+ Registered Central Mess kiosk: CENTRAL_MESS`);
    }
  }

  const allDevices = await prisma.device.findMany({
    where: { is_active: true },
    include: {
      gate: { include: { hostel: true } },
      mess: { include: { hostel: true } },
    },
  });

  console.log(`\n🎉 Distribution Complete! Total active kiosk devices on campus: ${allDevices.length}`);
  const gateDevices = allDevices.filter((d) => d.purpose === 'GATE');
  const messDevices = allDevices.filter((d) => d.purpose === 'MESS');
  console.log(`- Gate Kiosks: ${gateDevices.length}`);
  console.log(`- Mess Kiosks: ${messDevices.length}`);

  await prisma.$disconnect();
}

registerAllHostelKiosks().catch((err) => {
  console.error('Error in registerAllHostelKiosks:', err);
  process.exit(1);
});

