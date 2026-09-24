import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding MANIT Bhopal Campus Data into HOSTEL360...');

  // Password for seeded user accounts: "password123"
  const salt = await bcrypt.genSalt(10);
  const commonPasswordHash = await bcrypt.hash('password123', salt);

  // 1. Super Admin User (COW / DSW Office)
  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@hostel360.com' },
    update: {},
    create: {
      name: 'MANIT Dean of Student Welfare (DSW)',
      email: 'admin@hostel360.com',
      password_hash: commonPasswordHash,
      role: 'SUPER_ADMIN',
      is_active: true,
    },
  });

  // 2. Warden Users (Faculty in charge of hostels)
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

  // 3. Vice Warden Users (assists the Warden, reduced authority)
  const viceWardenH1 = await prisma.user.upsert({
    where: { email: 'vicewarden.h1@hostel360.com' },
    update: {},
    create: {
      name: 'Dr. A. K. Mishra (Vice Warden - H1)',
      email: 'vicewarden.h1@hostel360.com',
      password_hash: commonPasswordHash,
      role: 'VICE_WARDEN',
      is_active: true,
    },
  });

  const viceWardenH5 = await prisma.user.upsert({
    where: { email: 'vicewarden.h5@hostel360.com' },
    update: {},
    create: {
      name: 'Dr. P. S. Chauhan (Vice Warden - H5)',
      email: 'vicewarden.h5@hostel360.com',
      password_hash: commonPasswordHash,
      role: 'VICE_WARDEN',
      is_active: true,
    },
  });

  // 4. Caretaker Users (non-faculty operational staff)
  const caretakerH1 = await prisma.user.upsert({
    where: { email: 'caretaker.h1@hostel360.com' },
    update: {},
    create: {
      name: 'Shri Ram Prasad (Caretaker - H1)',
      email: 'caretaker.h1@hostel360.com',
      password_hash: commonPasswordHash,
      role: 'CARETAKER',
      is_active: true,
    },
  });

  const caretakerH5 = await prisma.user.upsert({
    where: { email: 'caretaker.h5@hostel360.com' },
    update: {},
    create: {
      name: 'Shri Mohan Lal (Caretaker - H5)',
      email: 'caretaker.h5@hostel360.com',
      password_hash: commonPasswordHash,
      role: 'CARETAKER',
      is_active: true,
    },
  });

  // 5. Mess Admin User
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

  // 6. MANIT Hostels Master Data (H1 to H12 from DATABASE_REQUIREMENTS_MANIT.md)
  const manitHostelData = [
    { num: 1, code: 'H1', name: 'Homi Jehangir Bhabha Bhawan', type: 'BOYS', has_blocks: false, location: 'MANIT Campus, Bhopal', capacity: 192 },
    { num: 2, code: 'H2', name: 'Vikram Sarabhai Bhawan', type: 'BOYS', has_blocks: false, location: 'MANIT Campus, Bhopal', capacity: 176 },
    { num: 3, code: 'H3', name: 'Hostel No. 3', type: 'BOYS', has_blocks: false, location: 'MANIT Campus, Bhopal', capacity: 120 },
    { num: 4, code: 'H4', name: 'Hostel No. 4', type: 'BOYS', has_blocks: false, location: 'MANIT Campus, Bhopal', capacity: 120 },
    { num: 5, code: 'H5', name: 'Mokshagundam Visvesvarayya Bhawan', type: 'BOYS', has_blocks: false, location: 'MANIT Campus, Bhopal', capacity: 80 },
    { num: 6, code: 'H6', name: 'Jagadish Chandra Bose Bhawan', type: 'BOYS', has_blocks: false, location: 'MANIT Campus, Bhopal', capacity: 80 },
    { num: 7, code: 'H7', name: 'Kalpana Chawla Bhawan', type: 'GIRLS', has_blocks: false, location: 'MANIT Girls Hostel Complex', capacity: 144 },
    { num: 8, code: 'H8', name: 'Ramanujan Bhawan', type: 'BOYS', has_blocks: false, location: 'MANIT Campus, Bhopal', capacity: 260 },
    { num: 9, code: 'H9', name: 'Raja Ramanna Bhawan', type: 'BOYS', has_blocks: false, location: 'MANIT Campus, Bhopal', capacity: 176 },
    { num: 10, code: 'H10', name: 'Dr. APJ Abdul Kalam Bhawan', type: 'BOYS', has_blocks: true, location: 'MANIT Campus, Bhopal (Fresher Hostel)', capacity: 1024 },
    { num: 11, code: 'H11', name: 'Appu Bhavan', type: 'BOYS', has_blocks: false, location: 'MANIT Campus, Bhopal (PhD / Scholars)', capacity: 48 },
    { num: 12, code: 'H12', name: 'Bhagini Nivedita Bhawan', type: 'GIRLS', has_blocks: false, location: 'MANIT Girls Hostel Complex', capacity: 200 },
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
      },
      create: {
        code: h.code,
        name: h.name,
        type: h.type,
        has_blocks: h.has_blocks,
        location: h.location,
        total_capacity: h.capacity,
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
              where: {
                hostel_id_block_room_number: {
                  hostel_id: hostel.id,
                  block: block,
                  room_number: roomNumber,
                },
              },
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
            where: {
              hostel_id_block_room_number: {
                hostel_id: hostel.id,
                block: '',  // null block stored as empty for non-block hostels
                room_number: roomNumber,
              },
            },
            update: {},
            create: {
              hostel_id: hostel.id,
              block: null,
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

  // 7. Staff Hostel Assignments (replaces old warden_id FK)
  // wardenBoys → boys hostels (H1-H6, H8-H11), primary warden
  const boysHostelNums = [1, 2, 3, 4, 5, 6, 8, 9, 10, 11];
  for (const num of boysHostelNums) {
    if (num === 5) continue; // H5 has its own warden
    await prisma.staffHostelAssignment.upsert({
      where: {
        user_id_hostel_id: {
          user_id: wardenBoys.id,
          hostel_id: hostelMap[num].id,
        },
      },
      update: {},
      create: {
        user_id: wardenBoys.id,
        hostel_id: hostelMap[num].id,
        role: 'WARDEN',
        is_primary: true,
      },
    });
  }

  // wardenGirls → girls hostels (H7, H12), primary warden
  for (const num of [7, 12]) {
    await prisma.staffHostelAssignment.upsert({
      where: {
        user_id_hostel_id: {
          user_id: wardenGirls.id,
          hostel_id: hostelMap[num].id,
        },
      },
      update: {},
      create: {
        user_id: wardenGirls.id,
        hostel_id: hostelMap[num].id,
        role: 'WARDEN',
        is_primary: true,
      },
    });
  }

  // wardenH5 → H5, primary warden
  await prisma.staffHostelAssignment.upsert({
    where: {
      user_id_hostel_id: {
        user_id: wardenH5.id,
        hostel_id: hostelMap[5].id,
      },
    },
    update: {},
    create: {
      user_id: wardenH5.id,
      hostel_id: hostelMap[5].id,
      role: 'WARDEN',
      is_primary: true,
    },
  });

  // viceWardenH1 → H1, vice warden
  await prisma.staffHostelAssignment.upsert({
    where: {
      user_id_hostel_id: {
        user_id: viceWardenH1.id,
        hostel_id: hostelMap[1].id,
      },
    },
    update: {},
    create: {
      user_id: viceWardenH1.id,
      hostel_id: hostelMap[1].id,
      role: 'VICE_WARDEN',
      is_primary: false,
    },
  });

  // viceWardenH5 → H5, vice warden
  await prisma.staffHostelAssignment.upsert({
    where: {
      user_id_hostel_id: {
        user_id: viceWardenH5.id,
        hostel_id: hostelMap[5].id,
      },
    },
    update: {},
    create: {
      user_id: viceWardenH5.id,
      hostel_id: hostelMap[5].id,
      role: 'VICE_WARDEN',
      is_primary: false,
    },
  });

  // caretakerH1 → H1
  await prisma.staffHostelAssignment.upsert({
    where: {
      user_id_hostel_id: {
        user_id: caretakerH1.id,
        hostel_id: hostelMap[1].id,
      },
    },
    update: {},
    create: {
      user_id: caretakerH1.id,
      hostel_id: hostelMap[1].id,
      role: 'CARETAKER',
      is_primary: false,
    },
  });

  // caretakerH5 → H5
  await prisma.staffHostelAssignment.upsert({
    where: {
      user_id_hostel_id: {
        user_id: caretakerH5.id,
        hostel_id: hostelMap[5].id,
      },
    },
    update: {},
    create: {
      user_id: caretakerH5.id,
      hostel_id: hostelMap[5].id,
      role: 'CARETAKER',
      is_primary: false,
    },
  });

  console.log('✅ Seeded Staff Hostel Assignments (wardens, vice wardens, caretakers).');

  // 8. Mess Setup
  const centralMess = await prisma.mess.upsert({
    where: { name: 'MANIT Central Campus Mess' },
    update: {},
    create: {
      name: 'MANIT Central Campus Mess',
      hostel_id: null,
    },
  });

  // 9. Staff Mess Assignment (replaces old mess_admin_id FK)
  await prisma.staffMessAssignment.upsert({
    where: {
      user_id_mess_id: {
        user_id: messAdminUser.id,
        mess_id: centralMess.id,
      },
    },
    update: {},
    create: {
      user_id: messAdminUser.id,
      mess_id: centralMess.id,
      role: 'MESS_ADMIN',
    },
  });

  console.log('✅ Seeded Mess with Staff Mess Assignment.');

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

  // 10. Seed Students (Enforcing gender-to-hostel binding)
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
  console.log('');
  console.log('📋 Login Credentials:');
  console.log('  Super Admin (DSW): admin@hostel360.com / password123');
  console.log('  Warden (Boys):     warden.boys@hostel360.com / password123');
  console.log('  Warden (Girls):    warden.girls@hostel360.com / password123');
  console.log('  Warden (H5):       warden.h5@hostel360.com / password123');
  console.log('  Vice Warden (H1):  vicewarden.h1@hostel360.com / password123');
  console.log('  Vice Warden (H5):  vicewarden.h5@hostel360.com / password123');
  console.log('  Caretaker (H1):    caretaker.h1@hostel360.com / password123');
  console.log('  Caretaker (H5):    caretaker.h5@hostel360.com / password123');
  console.log('  Mess Admin:        messadmin@hostel360.com / password123');
  console.log('  Student (Aarav):   aarav.sharma@student.hostel360.com / password123');
}

main()
  .catch((e) => {
    console.error('Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
