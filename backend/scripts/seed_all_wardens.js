import bcrypt from 'bcrypt';
import prisma from '../src/prisma.js';

export const MANIT_WARDENS = [
  {
    code: 'H1',
    hostelName: 'Homi Jehangir Bhabha Bhawan',
    wardenName: 'Dr. A. K. Sharma (Warden - H1)',
    email: 'warden.h1@hostel360.com',
  },
  {
    code: 'H2',
    hostelName: 'Vikram Sarabhai Bhawan',
    wardenName: 'Dr. S. K. Gupta (Warden - H2)',
    email: 'warden.h2@hostel360.com',
  },
  {
    code: 'H3',
    hostelName: 'Hostel No. 3',
    wardenName: 'Dr. Manoj Kumar (Warden - H3)',
    email: 'warden.h3@hostel360.com',
  },
  {
    code: 'H4',
    hostelName: 'Hostel No. 4',
    wardenName: 'Dr. R. K. Singh (Warden - H4)',
    email: 'warden.h4@hostel360.com',
  },
  {
    code: 'H5',
    hostelName: 'Mokshagundam Visvesvarayya Bhawan',
    wardenName: 'Dr. V. K. Verma (Warden - H5)',
    email: 'warden.h5@hostel360.com',
  },
  {
    code: 'H6',
    hostelName: 'Jagadish Chandra Bose Bhawan',
    wardenName: 'Dr. Amit Joshi (Warden - H6)',
    email: 'warden.h6@hostel360.com',
  },
  {
    code: 'H7',
    hostelName: 'Kalpana Chawla Bhawan (Girls)',
    wardenName: 'Dr. Sunita Patel (Warden - H7)',
    email: 'warden.h7@hostel360.com',
  },
  {
    code: 'H8',
    hostelName: 'Ramanujan Bhawan',
    wardenName: 'Dr. Neeraj Jain (Warden - H8)',
    email: 'warden.h8@hostel360.com',
  },
  {
    code: 'H9',
    hostelName: 'Raja Ramanna Bhawan',
    wardenName: 'Dr. Sanjay Tiwari (Warden - H9)',
    email: 'warden.h9@hostel360.com',
  },
  {
    code: 'H10',
    hostelName: 'Dr. APJ Abdul Kalam Bhawan',
    wardenName: 'Dr. D. K. Agarwal (Warden - H10)',
    email: 'warden.h10@hostel360.com',
  },
  {
    code: 'H11',
    hostelName: 'Appu Bhavan',
    wardenName: 'Dr. Alok Tripathi (Warden - H11)',
    email: 'warden.h11@hostel360.com',
  },
  {
    code: 'H12',
    hostelName: 'Bhagini Nivedita Bhawan (Girls)',
    wardenName: 'Dr. Priya Sharma (Warden - H12)',
    email: 'warden.h12@hostel360.com',
  },
];

export async function seedAllWardens() {
  console.log('🏛️  Seeding dedicated Wardens for all 12 MANIT Hostels (H1 to H12)...');

  const salt = await bcrypt.genSalt(10);
  const commonPasswordHash = await bcrypt.hash('password123', salt);

  for (const item of MANIT_WARDENS) {
    const hostel = await prisma.hostel.findUnique({
      where: { code: item.code },
    });

    if (!hostel) {
      console.warn(`⚠️ Hostel with code ${item.code} not found. Skipping.`);
      continue;
    }

    // 1. Upsert Warden User
    const user = await prisma.user.upsert({
      where: { email: item.email },
      update: {
        name: item.wardenName,
        password_hash: commonPasswordHash,
        role: 'WARDEN',
        is_active: true,
      },
      create: {
        name: item.wardenName,
        email: item.email,
        password_hash: commonPasswordHash,
        role: 'WARDEN',
        is_active: true,
      },
    });

    // 2. Upsert Staff Hostel Assignment (Primary Warden)
    await prisma.staffHostelAssignment.upsert({
      where: {
        user_id_hostel_id: {
          user_id: user.id,
          hostel_id: hostel.id,
        },
      },
      update: {
        role: 'WARDEN',
        is_primary: true,
        end_date: null,
      },
      create: {
        user_id: user.id,
        hostel_id: hostel.id,
        role: 'WARDEN',
        is_primary: true,
      },
    });

    console.log(`✅ [${item.code}] ${item.wardenName} (${item.email}) assigned to ${hostel.name}`);
  }

  console.log('\n🎉 All 12 Hostel Wardens successfully registered and assigned in database!');
}

const isDirectRun = process.argv[1]?.endsWith('seed_all_wardens.js');
if (isDirectRun) {
  seedAllWardens()
    .catch((err) => {
      console.error('Failed seeding wardens:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
