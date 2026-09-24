import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding MANIT Bhopal Campus Data into HOSTEL360...');

  // Password for seeded user accounts: "password123"
  const salt = await bcrypt.genSalt(10);
  const commonPasswordHash = await bcrypt.hash('password123', salt);

  // 1. Super Admin User
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

  // 2. Warden Users
  const wardenBoys = await prisma.user.upsert({
    where: { email: 'warden.boys@hostel360.com' },
    update: {},
    create: {
      name: 'Dr. R. K. Sharma (Chief Warden - Boys)',
      email: 'warden.boys@hostel360.com',
      password_hash: commonPasswordHash,
      role: 'WARDEN',
      is_active: true,
    },
  });

  const wardenGirls = await prisma.user.upsert({
    where: { email: 'warden.girls@hostel360.com' },
    update: {},
    create: {
      name: 'Dr. Sunita Patel (Warden - Girls Hostels)',
      email: 'warden.girls@hostel360.com',
      password_hash: commonPasswordHash,
      role: 'WARDEN',
      is_active: true,
    },
  });

  const wardenH5 = await prisma.user.upsert({
    where: { email: 'warden.h5@hostel360.com' },
    update: {},
    create: {
      name: 'Dr. V. K. Verma (Warden - H5)',
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

  // 4. MANIT Hostels Master Data (H1 to H12 from DATABASE_REQUIREMENTS_MANIT.md)
  const manitHostelData = [
    { num: 1, code: 'H1', name: 'Homi Jehangir Bhabha Bhawan', type: 'BOYS', has_blocks: false, location: 'MANIT Campus, Bhopal', capacity: 192, wardenId: wardenBoys.id },
    { num: 2, code: 'H2', name: 'Vikram Sarabhai Bhawan', type: 'BOYS', has_blocks: false, location: 'MANIT Campus, Bhopal', capacity: 176, wardenId: wardenBoys.id },
    { num: 3, code: 'H3', name: 'Hostel No. 3', type: 'BOYS', has_blocks: false, location: 'MANIT Campus, Bhopal', capacity: 120, wardenId: wardenBoys.id },
    { num: 4, code: 'H4', name: 'Hostel No. 4', type: 'BOYS', has_blocks: false, location: 'MANIT Campus, Bhopal', capacity: 120, wardenId: wardenBoys.id },
    { num: 5, code: 'H5', name: 'Mokshagundam Visvesvarayya Bhawan', type: 'BOYS', has_blocks: false, location: 'MANIT Campus, Bhopal', capacity: 80, wardenId: wardenH5.id },
    { num: 6, code: 'H6', name: 'Jagadish Chandra Bose Bhawan', type: 'BOYS', has_blocks: false, location: 'MANIT Campus, Bhopal', capacity: 80, wardenId: wardenBoys.id },
    { num: 7, code: 'H7', name: 'Kalpana Chawla Bhawan', type: 'GIRLS', has_blocks: false, location: 'MANIT Girls Hostel Complex', capacity: 144, wardenId: wardenGirls.id },
    { num: 8, code: 'H8', name: 'Ramanujan Bhawan', type: 'BOYS', has_blocks: false, location: 'MANIT Campus, Bhopal', capacity: 260, wardenId: wardenBoys.id },
    { num: 9, code: 'H9', name: 'Raja Ramanna Bhawan', type: 'BOYS', has_blocks: false, location: 'MANIT Campus, Bhopal', capacity: 176, wardenId: wardenBoys.id },
    { num: 10, code: 'H10', name: 'Dr. APJ Abdul Kalam Bhawan', type: 'BOYS', has_blocks: true, location: 'MANIT Campus, Bhopal (Fresher Hostel)', capacity: 1024, wardenId: wardenBoys.id },
    { num: 11, code: 'H11', name: 'Appu Bhavan', type: 'BOYS', has_blocks: false, location: 'MANIT Campus, Bhopal (PhD / Scholars)', capacity: 48, wardenId: wardenBoys.id },
    { num: 12, code: 'H12', name: 'Bhagini Nivedita Bhawan', type: 'GIRLS', has_blocks: false, location: 'MANIT Girls Hostel Complex', capacity: 200, wardenId: wardenGirls.id },
  ];

  const hostelMap = {};
  const roomMap = {};

  for (const h of manitHostelData) {
    const hostel = await prisma.hostel.upsert({
      where: { code: h.code },
      update: {
        name: h.name,
        type: h.type,
        has_blocks: h.has_blocks,
        location: h.location,
        total_capacity: h.capacity,
        warden_id: h.wardenId,
      },
      create: {
        code: h.code,
        name: h.name,
        type: h.type,
        has_blocks: h.has_blocks,
        location: h.location,
        total_capacity: h.capacity,
        warden_id: h.wardenId,
      },
    });

    hostelMap[h.num] = hostel;
    roomMap[h.num] = [];

    // Seed sample rooms following 5-digit convention [HH][F][RR]
    const hh = String(h.num).padStart(2, '0');

    if (h.has_blocks) {
      // H10: [HH][BLOCK][F][RR] (e.g. 10A001, 10A101, 10B001, 10C001, 10D001)
      for (const block of ['A', 'B', 'C', 'D']) {
        for (let f = 0; f <= 1; f++) {
          for (let r = 1; r <= 2; r++) {
            const rr = String(r).padStart(2, '0');
            const roomNumber = `${hh}${block}${f}${rr}`;
            const room = await prisma.room.upsert({
              where: { room_number: roomNumber },
              update: {},
              create: {
                hostel_id: hostel.id,
                block,
                floor: f,
                room_number: roomNumber,
                capacity: 2,
                status: 'ACTIVE',
              },
            });
            roomMap[h.num].push(room);
          }
        }
      }
    } else {
      // Single-building hostels: [HH][F][RR] (e.g. 01001, 01002, 01101, 01102)
      for (let f = 0; f <= 1; f++) {
        for (let r = 1; r <= 4; r++) {
          const rr = String(r).padStart(2, '0');
          const roomNumber = `${hh}${f}${rr}`;
          const capacity = [5, 6, 11].includes(h.num) ? 1 : 2;
          const room = await prisma.room.upsert({
            where: { room_number: roomNumber },
            update: {},
            create: {
              hostel_id: hostel.id,
              floor: f,
              room_number: roomNumber,
              capacity,
              status: 'ACTIVE',
            },
          });
          roomMap[h.num].push(room);
        }
      }
    }

    // Seed Gates
    const gateNames = h.has_blocks
      ? ['Block A Gate', 'Block B Gate', 'Block C Gate', 'Block D Gate']
      : ['Main Gate', 'Side Gate'];

    for (const gName of gateNames) {
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

  console.log('✅ Seeded 12 MANIT Hostels (H1-H12) with 5-digit room codes [HH][F][RR] and gates.');

  // 5. Mess Setup
  const centralMess = await prisma.mess.upsert({
    where: { name: 'MANIT Central Campus Mess' },
    update: {},
    create: {
      name: 'MANIT Central Campus Mess',
      hostel_id: null,
      mess_admin_id: messAdminUser.id,
    },
  });

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

  // 6. Seed Students (Enforcing gender-to-hostel binding)
  const studentProfiles = [
    {
      name: 'Aarav Sharma',
      email: 'aarav.sharma@student.hostel360.com',
      roll_number: '232112001',
      gender: 'MALE',
      department: 'MCA',
      year: 2,
      hostelNum: 1, // H1 - Homi Bhabha (Boys)
      roomIdx: 0,
      photo_url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200&h=200&fit=crop&crop=faces',
    },
    {
      name: 'Vivaan Patel',
      email: 'vivaan.patel@student.hostel360.com',
      roll_number: '232112002',
      gender: 'MALE',
      department: 'CSE',
      year: 2,
      hostelNum: 5, // H5 - Visvesvarayya (Boys)
      roomIdx: 1,
      photo_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=faces',
    },
    {
      name: 'Ananya Verma',
      email: 'ananya.verma@student.hostel360.com',
      roll_number: '232112003',
      gender: 'FEMALE',
      department: 'ECE',
      year: 3,
      hostelNum: 7, // H7 - Kalpana Chawla (Girls)
      roomIdx: 0,
      photo_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=faces',
    },
    {
      name: 'Rohan Gupta',
      email: 'rohan.gupta@student.hostel360.com',
      roll_number: '232112004',
      gender: 'MALE',
      department: 'ME',
      year: 1,
      hostelNum: 10, // H10 - Kalam Bhawan (Fresher Boys)
      roomIdx: 0,
      photo_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&crop=faces',
    },
    {
      name: 'Diya Sen',
      email: 'diya.sen@student.hostel360.com',
      roll_number: '232112005',
      gender: 'FEMALE',
      department: 'MCA',
      year: 1,
      hostelNum: 12, // H12 - Bhagini Nivedita (Girls)
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

    const targetHostel = hostelMap[s.hostelNum];
    const targetRoom = roomMap[s.hostelNum][s.roomIdx];

    await prisma.student.upsert({
      where: { user_id: user.id },
      update: {
        roll_number: s.roll_number,
        gender: s.gender,
        department: s.department,
        year: s.year,
        hostel_id: targetHostel.id,
        room_id: targetRoom.id,
      },
      create: {
        user_id: user.id,
        roll_number: s.roll_number,
        gender: s.gender,
        department: s.department,
        year: s.year,
        hostel_id: targetHostel.id,
        room_id: targetRoom.id,
        photo_url: s.photo_url,
        current_state: 'INSIDE',
      },
    });
  }

  console.log('✅ Seeded 5 MANIT students with gender-appropriate hostel assignments.');
  console.log('🚀 MANIT Campus Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
