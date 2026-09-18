import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Common password hash for test accounts: "password123"
  const salt = await bcrypt.genSalt(10);
  const commonPasswordHash = await bcrypt.hash('password123', salt);

  // 1. Super Admin
  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@hostel360.com' },
    update: {},
    create: {
      name: 'Chief Administrator',
      email: 'admin@hostel360.com',
      password_hash: commonPasswordHash,
      role: 'SUPER_ADMIN',
      is_active: true,
    },
  });
  console.log(`Created/Verified Super Admin: ${superAdmin.email}`);

  // 2. Warden User
  const wardenUser = await prisma.user.upsert({
    where: { email: 'warden.h5@hostel360.com' },
    update: {},
    create: {
      name: 'Dr. Robert Warden',
      email: 'warden.h5@hostel360.com',
      password_hash: commonPasswordHash,
      role: 'WARDEN',
      is_active: true,
    },
  });

  // 3. Mess Admin User
  const messAdminUser = await prisma.user.upsert({
    where: { email: 'messadmin@hostel360.com' },
    update: {},
    create: {
      name: 'Chef Suresh Mess Admin',
      email: 'messadmin@hostel360.com',
      password_hash: commonPasswordHash,
      role: 'MESS_ADMIN',
      is_active: true,
    },
  });

  // 4. Hostels
  const hostel1 = await prisma.hostel.upsert({
    where: { name: 'H5 Boys Hostel' },
    update: {},
    create: {
      name: 'H5 Boys Hostel',
      location: 'North Campus, Sector 4',
      total_capacity: 200,
      warden_id: wardenUser.id,
    },
  });

  const hostel2 = await prisma.hostel.upsert({
    where: { name: 'H6 Girls Hostel' },
    update: {},
    create: {
      name: 'H6 Girls Hostel',
      location: 'South Campus, Sector 2',
      total_capacity: 150,
    },
  });
  console.log(`Created/Verified Hostels: ${hostel1.name}, ${hostel2.name}`);

  // 5. Rooms (4 each)
  const roomNumbersH5 = ['101', '102', '103', '104'];
  const roomsH5 = [];
  for (const rNum of roomNumbersH5) {
    const room = await prisma.room.upsert({
      where: {
        hostel_id_room_number: {
          hostel_id: hostel1.id,
          room_number: rNum,
        },
      },
      update: {},
      create: {
        hostel_id: hostel1.id,
        room_number: rNum,
        capacity: 2,
      },
    });
    roomsH5.push(room);
  }

  const roomNumbersH6 = ['201', '202', '203', '204'];
  const roomsH6 = [];
  for (const rNum of roomNumbersH6) {
    const room = await prisma.room.upsert({
      where: {
        hostel_id_room_number: {
          hostel_id: hostel2.id,
          room_number: rNum,
        },
      },
      update: {},
      create: {
        hostel_id: hostel2.id,
        room_number: rNum,
        capacity: 2,
      },
    });
    roomsH6.push(room);
  }
  console.log(`Created 4 rooms in H5 and 4 rooms in H6`);

  // 6. Gates (2 each)
  const gatesH5 = ['Main Gate', 'North Gate'];
  for (const gName of gatesH5) {
    const existing = await prisma.gate.findFirst({
      where: { hostel_id: hostel1.id, name: gName },
    });
    if (!existing) {
      await prisma.gate.create({
        data: {
          hostel_id: hostel1.id,
          name: gName,
        },
      });
    }
  }

  const gatesH6 = ['Main Gate', 'South Gate'];
  for (const gName of gatesH6) {
    const existing = await prisma.gate.findFirst({
      where: { hostel_id: hostel2.id, name: gName },
    });
    if (!existing) {
      await prisma.gate.create({
        data: {
          hostel_id: hostel2.id,
          name: gName,
        },
      });
    }
  }
  console.log(`Created 2 gates in H5 and 2 gates in H6`);

  // 7. Shared Central Mess
  const centralMess = await prisma.mess.upsert({
    where: { name: 'Central Campus Mess' },
    update: {},
    create: {
      name: 'Central Campus Mess',
      hostel_id: null,
      mess_admin_id: messAdminUser.id,
    },
  });
  console.log(`Created/Verified Mess: ${centralMess.name}`);

  // 8. Meal Windows (4 meal types)
  const mealWindowsData = [
    { meal_type: 'BREAKFAST', start_time: '07:30', end_time: '09:30' },
    { meal_type: 'LUNCH', start_time: '12:30', end_time: '14:30' },
    { meal_type: 'SNACKS', start_time: '17:00', end_time: '18:30' },
    { meal_type: 'DINNER', start_time: '20:00', end_time: '22:00' },
  ];

  for (const mw of mealWindowsData) {
    const existing = await prisma.mealWindow.findFirst({
      where: { mess_id: centralMess.id, meal_type: mw.meal_type },
    });
    if (!existing) {
      await prisma.mealWindow.create({
        data: {
          mess_id: centralMess.id,
          meal_type: mw.meal_type,
          start_time: mw.start_time,
          end_time: mw.end_time,
          is_active: true,
        },
      });
    }
  }
  console.log(`Created 4 meal windows for ${centralMess.name}`);

  // 9. 5 Students with linked Users
  const studentProfiles = [
    {
      name: 'Aarav Sharma',
      email: 'aarav.sharma@student.hostel360.com',
      roll_number: 'MCA2024001',
      hostel: hostel1,
      room: roomsH5[0],
      photo_url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200&h=200&fit=crop&crop=faces',
    },
    {
      name: 'Vivaan Patel',
      email: 'vivaan.patel@student.hostel360.com',
      roll_number: 'MCA2024002',
      hostel: hostel1,
      room: roomsH5[1],
      photo_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=faces',
    },
    {
      name: 'Ananya Verma',
      email: 'ananya.verma@student.hostel360.com',
      roll_number: 'MCA2024003',
      hostel: hostel2,
      room: roomsH6[0],
      photo_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=faces',
    },
    {
      name: 'Rohan Gupta',
      email: 'rohan.gupta@student.hostel360.com',
      roll_number: 'MCA2024004',
      hostel: hostel1,
      room: roomsH5[2],
      photo_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&crop=faces',
    },
    {
      name: 'Diya Sen',
      email: 'diya.sen@student.hostel360.com',
      roll_number: 'MCA2024005',
      hostel: hostel2,
      room: roomsH6[1],
      photo_url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop&crop=faces',
    },
  ];

  for (const s of studentProfiles) {
    const user = await prisma.user.upsert({
      where: { email: s.email },
      update: {},
      create: {
        name: s.name,
        email: s.email,
        password_hash: commonPasswordHash,
        role: 'STUDENT',
        is_active: true,
      },
    });

    await prisma.student.upsert({
      where: { roll_number: s.roll_number },
      update: {},
      create: {
        user_id: user.id,
        roll_number: s.roll_number,
        hostel_id: s.hostel.id,
        room_id: s.room.id,
        photo_url: s.photo_url,
        current_state: 'INSIDE',
      },
    });
  }
  console.log(`Created 5 students with linked user accounts (password: password123)`);

  console.log('Seeding completed successfully! 🚀');
}

main()
  .catch((e) => {
    console.error('Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
