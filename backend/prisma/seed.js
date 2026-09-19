import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding MANIT Hostel & Mess Database for HOSTEL360...');

  // Common password hash for test accounts: "password123"
  const salt = await bcrypt.genSalt(10);
  const commonPasswordHash = await bcrypt.hash('password123', salt);

  // 1. Super Admin
  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@hostel360.com' },
    update: {},
    create: {
      name: 'MANIT Chief Administrator',
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
      name: 'Dr. R. K. Sharma (Warden)',
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
      name: 'S. K. Verma (MANIT Mess Manager)',
      email: 'messadmin@hostel360.com',
      password_hash: commonPasswordHash,
      role: 'MESS_ADMIN',
      is_active: true,
    },
  });

  // 4. MANIT Hostels 1 to 12 (7 and 12 are Girls Hostels, rest are Boys)
  const manitHostelConfigs = [
    { number: 1, type: 'BOYS', location: 'MANIT West Campus' },
    { number: 2, type: 'BOYS', location: 'MANIT West Campus' },
    { number: 3, type: 'BOYS', location: 'MANIT Central Campus' },
    { number: 4, type: 'BOYS', location: 'MANIT Central Campus' },
    { number: 5, type: 'BOYS', location: 'MANIT South Campus' },
    { number: 6, type: 'BOYS', location: 'MANIT South Campus' },
    { number: 7, type: 'GIRLS', location: 'MANIT Girls Hostel Complex' },
    { number: 8, type: 'BOYS', location: 'MANIT North Campus' },
    { number: 9, type: 'BOYS', location: 'MANIT North Campus' },
    { number: 10, type: 'BOYS', location: 'MANIT PG Block' },
    { number: 11, type: 'BOYS', location: 'MANIT New Boys Block' },
    { number: 12, type: 'GIRLS', location: 'MANIT New Girls Block' },
  ];

  const hostelRecords = {};
  const hostelRooms = {};

  for (const h of manitHostelConfigs) {
    const hostelName = `Hostel ${h.number}`;
    const hostel = await prisma.hostel.upsert({
      where: { name: hostelName },
      update: {
        type: h.type,
        location: h.location,
      },
      create: {
        name: hostelName,
        type: h.type,
        location: h.location,
        total_capacity: 300,
        warden_id: h.number === 5 ? wardenUser.id : null,
      },
    });

    hostelRecords[h.number] = hostel;

    // Create 4 rooms for each hostel
    hostelRooms[h.number] = [];
    for (const rNum of ['101', '102', '103', '104']) {
      const room = await prisma.room.upsert({
        where: {
          hostel_id_room_number: {
            hostel_id: hostel.id,
            room_number: rNum,
          },
        },
        update: {},
        create: {
          hostel_id: hostel.id,
          room_number: rNum,
          capacity: 2,
        },
      });
      hostelRooms[h.number].push(room);
    }

    // Create 2 gates for each hostel (Main Gate & Back Gate)
    for (const gName of ['Main Gate', 'Side Gate']) {
      const existingGate = await prisma.gate.findFirst({
        where: { hostel_id: hostel.id, name: gName },
      });
      if (!existingGate) {
        await prisma.gate.create({
          data: {
            hostel_id: hostel.id,
            name: gName,
          },
        });
      }
    }
  }

  console.log(`Created/Verified all 12 MANIT Hostels (Hostel 7 & 12 Girls, Hostels 1-6 & 8-11 Boys) with rooms and gates`);

  // 5. Shared MANIT Central Mess
  const centralMess = await prisma.mess.upsert({
    where: { name: 'MANIT Central Campus Mess' },
    update: {},
    create: {
      name: 'MANIT Central Campus Mess',
      hostel_id: null,
      mess_admin_id: messAdminUser.id,
    },
  });
  console.log(`Created/Verified Mess: ${centralMess.name}`);

  // 6. Meal Windows (4 meal types)
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

  // 7. Students assigned to MANIT Hostels
  const studentProfiles = [
    {
      name: 'Aarav Sharma',
      email: 'aarav.sharma@student.hostel360.com',
      roll_number: '232112001',
      hostelNum: 1, // Boys
      roomIdx: 0,
      photo_url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200&h=200&fit=crop&crop=faces',
    },
    {
      name: 'Vivaan Patel',
      email: 'vivaan.patel@student.hostel360.com',
      roll_number: '232112002',
      hostelNum: 5, // Boys
      roomIdx: 1,
      photo_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=faces',
    },
    {
      name: 'Ananya Verma',
      email: 'ananya.verma@student.hostel360.com',
      roll_number: '232112003',
      hostelNum: 7, // Girls
      roomIdx: 0,
      photo_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=faces',
    },
    {
      name: 'Rohan Gupta',
      email: 'rohan.gupta@student.hostel360.com',
      roll_number: '232112004',
      hostelNum: 10, // Boys
      roomIdx: 2,
      photo_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&crop=faces',
    },
    {
      name: 'Diya Sen',
      email: 'diya.sen@student.hostel360.com',
      roll_number: '232112005',
      hostelNum: 12, // Girls
      roomIdx: 1,
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

    const targetHostel = hostelRecords[s.hostelNum];
    const targetRoom = hostelRooms[s.hostelNum][s.roomIdx];

    await prisma.student.upsert({
      where: { user_id: user.id },
      update: {
        roll_number: s.roll_number,
        hostel_id: targetHostel.id,
        room_id: targetRoom.id,
      },
      create: {
        user_id: user.id,
        roll_number: s.roll_number,
        hostel_id: targetHostel.id,
        room_id: targetRoom.id,
        photo_url: s.photo_url,
        current_state: 'INSIDE',
      },
    });
  }

  console.log(`Created 5 MANIT students with linked user accounts assigned to Hostels 1, 5, 7 (Girls), 10, and 12 (Girls)`);
  console.log('MANIT Database Seeding completed successfully! 🚀');
}

main()
  .catch((e) => {
    console.error('Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
