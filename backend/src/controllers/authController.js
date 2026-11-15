import bcrypt from 'bcrypt';
import prisma from '../prisma.js';
import { generateAccessToken, generateRefreshToken, hashToken } from '../utils/token.js';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('Invalid email address').max(255),
  password: z.string().min(1, 'Password is required').max(128),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

const logoutSchema = z.object({
  refreshToken: z.string().optional(),
});

const registerStudentSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(120),
  email: z.string().trim().email('Invalid college email address').max(255),
  password: z.string().min(6, 'Password must be at least 6 characters').max(128),
  roll_number: z.string().trim().min(2, 'Roll / Scholar number is required').max(30),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
  department: z.string().trim().min(2, 'Department is required').max(50),
  year: z.coerce.number().int().min(1).max(5),
  hostel_id: z.string().uuid('Please select a valid hostel'),
  accessibility_needs: z.boolean().optional().default(false),
  accessibility_details: z.string().max(500).optional().nullable(),
});

export async function login(req, res) {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: {
        student: {
          include: {
            hostel: true,
            room: true,
          },
        },
      },
    });

    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (['WARDEN', 'VICE_WARDEN', 'CARETAKER', 'MESS_ADMIN'].includes(user.role)) {
      const [hostelActive, messActive] = await Promise.all([
        prisma.staffHostelAssignment.count({ where: { user_id: user.id, end_date: null } }),
        prisma.staffMessAssignment.count({ where: { user_id: user.id, end_date: null } }),
      ]);
      if (hostelActive + messActive === 0) {
        return res.status(403).json({
          error: 'Access denied: Staff account has no currently active assignments across the campus.',
          code: 'NO_ACTIVE_ASSIGNMENT',
        });
      }
    }

    const accessToken = generateAccessToken(user);
    const rawRefreshToken = generateRefreshToken();
    const tokenHash = hashToken(rawRefreshToken);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.$transaction([
      prisma.refreshToken.create({
        data: {
          user_id: user.id,
          token_hash: tokenHash,
          expires_at: expiresAt,
        },
      }),
      prisma.auditLog.create({
        data: {
          actor_id: user.id,
          actor_type: 'USER',
          action: 'USER_LOGIN',
          target_type: 'User',
          target_id: user.id,
          meta: { ip: req.ip, userAgent: req.headers['user-agent'] },
        },
      }),
    ]);

    const { password_hash, ...userProfile } = user;

    return res.json({
      message: 'Login successful',
      accessToken,
      refreshToken: rawRefreshToken,
      user: userProfile,
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error during login' });
  }
}

export async function refresh(req, res) {
  try {
    const parsed = refreshSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { refreshToken } = parsed.data;
    const hashed = hashToken(refreshToken);
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token_hash: hashed },
      include: { user: true },
    });

    if (!storedToken) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    // Single-use reuse detection: if revoked token presented, revoke ALL tokens for this user
    if (storedToken.revoked_at) {
      console.warn(`[SECURITY ALERT] Refresh token reuse detected for user ${storedToken.user_id}! Revoking all sessions.`);
      await prisma.refreshToken.updateMany({
        where: { user_id: storedToken.user_id },
        data: { revoked_at: new Date() },
      });

      await prisma.auditLog.create({
        data: {
          actor_id: storedToken.user_id,
          actor_type: 'SYSTEM',
          action: 'SECURITY_ALERT_REFRESH_TOKEN_REUSE',
          target_type: 'User',
          target_id: storedToken.user_id,
          meta: { ip: req.ip },
        },
      });

      return res.status(401).json({ error: 'Security breach alert: Token reuse detected. Please log in again.' });
    }

    // Check expiry
    if (new Date() > storedToken.expires_at) {
      return res.status(401).json({ error: 'Refresh token expired' });
    }

    if (!storedToken.user.is_active) {
      return res.status(401).json({ error: 'User is inactive' });
    }

    // Rotate tokens atomically
    const newAccessToken = generateAccessToken(storedToken.user);
    const newRawRefreshToken = generateRefreshToken();
    const newHashed = hashToken(newRawRefreshToken);

    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + 7);

    await prisma.$transaction([
      prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { revoked_at: new Date() },
      }),
      prisma.refreshToken.create({
        data: {
          user_id: storedToken.user_id,
          token_hash: newHashed,
          expires_at: newExpiresAt,
        },
      }),
    ]);

    return res.json({
      accessToken: newAccessToken,
      refreshToken: newRawRefreshToken,
    });
  } catch (error) {
    console.error('Refresh error:', error);
    return res.status(500).json({ error: 'Internal server error during token refresh' });
  }
}

export async function logout(req, res) {
  try {
    const parsed = logoutSchema.safeParse(req.body);
    const refreshToken = parsed.success ? parsed.data.refreshToken : req.body?.refreshToken;
    if (refreshToken) {
      const hashed = hashToken(refreshToken);
      await prisma.refreshToken.updateMany({
        where: { token_hash: hashed, revoked_at: null },
        data: { revoked_at: new Date() },
      });
    }

    if (req.user) {
      await prisma.auditLog.create({
        data: {
          actor_id: req.user.id,
          actor_type: 'USER',
          action: 'USER_LOGOUT',
          target_type: 'User',
          target_id: req.user.id,
        },
      });
    }

    return res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({ error: 'Internal server error during logout' });
  }
}

export async function getMe(req, res) {
  try {
    return res.json({ user: req.user });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch user profile' });
  }
}

/**
 * Public endpoint: Returns available hostels and active admission windows for student registration.
 */
export async function getRegistrationOptions(req, res) {
  try {
    const hostels = await prisma.hostel.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        location: true,
        total_capacity: true,
        has_blocks: true,
        _count: {
          select: { students: true, rooms: true },
        },
      },
      orderBy: { code: 'asc' },
    });

    const activeWindows = await prisma.registrationWindow.findMany({
      where: { status: 'OPEN' },
      select: {
        id: true,
        academic_year: true,
        semester: true,
        open_from: true,
        open_to: true,
        hostel_id: true,
      },
    });

    const departments = [
      'Computer Science & Engineering',
      'Electronics & Communication Engineering',
      'Electrical Engineering',
      'Mechanical Engineering',
      'Civil Engineering',
      'Chemical Engineering',
      'Materials & Metallurgical Engineering',
      'Architecture & Planning',
      'Master of Computer Applications (MCA)',
      'Management Studies (MBA)',
      'Applied Sciences & Humanities',
    ];

    return res.json({
      hostels,
      activeWindows,
      departments,
    });
  } catch (error) {
    console.error('getRegistrationOptions error:', error);
    return res.status(500).json({ error: 'Failed to fetch registration options' });
  }
}

/**
 * Public endpoint: Registers a student account and simultaneously enrolls them into the
 * batch hostel room allocation lottery.
 */
export async function registerStudentWithLottery(req, res) {
  try {
    const parsed = registerStudentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const {
      name,
      email,
      password,
      roll_number,
      gender,
      department,
      year,
      hostel_id,
      accessibility_needs,
      accessibility_details,
    } = parsed.data;

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedRoll = roll_number.toUpperCase().trim();

    // 1. Check if email is already taken
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingUser) {
      return res.status(409).json({
        error: 'An account with this email address already exists. Please sign in instead.',
      });
    }

    // 2. Check if roll number is already registered
    const existingStudent = await prisma.student.findUnique({
      where: { roll_number: normalizedRoll },
    });
    if (existingStudent) {
      return res.status(409).json({
        error: 'A student with this Roll / Scholar number is already registered.',
      });
    }

    // 3. Verify selected hostel
    const targetHostel = await prisma.hostel.findUnique({
      where: { id: hostel_id },
    });
    if (!targetHostel) {
      return res.status(404).json({ error: 'Selected hostel was not found.' });
    }

    if (gender === 'MALE' && targetHostel.type === 'GIRLS') {
      return res.status(400).json({ error: 'Male students cannot apply to a Girls hostel.' });
    }
    if (gender === 'FEMALE' && targetHostel.type === 'BOYS') {
      return res.status(400).json({ error: 'Female students cannot apply to a Boys hostel.' });
    }

    // 4. Resolve or auto-create an OPEN registration window for the lottery
    let window = await prisma.registrationWindow.findFirst({
      where: {
        status: 'OPEN',
        OR: [{ hostel_id: null }, { hostel_id: targetHostel.id }],
      },
      orderBy: { created_at: 'desc' },
    });

    if (!window) {
      const now = new Date();
      const nextYear = new Date();
      nextYear.setFullYear(now.getFullYear() + 1);

      window = await prisma.registrationWindow.create({
        data: {
          hostel_id: null,
          academic_year: `${now.getFullYear()}-${now.getFullYear() + 1}`,
          semester: 1,
          open_from: now,
          open_to: nextYear,
          status: 'OPEN',
        },
      });
    }

    // 5. Hash password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // 6. Execute atomic creation: User + Student + HostelApplication (Lottery Pool)
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email: normalizedEmail,
          password_hash,
          role: 'STUDENT',
          is_active: true,
        },
      });

      const student = await tx.student.create({
        data: {
          user_id: user.id,
          roll_number: normalizedRoll,
          gender,
          department,
          year,
          hostel_id: targetHostel.id,
          room_id: null, // Room will be allocated via batch lottery
          current_state: 'INSIDE',
        },
        include: {
          hostel: {
            select: { id: true, name: true, code: true, type: true },
          },
        },
      });

      const application = await tx.hostelApplication.create({
        data: {
          window_id: window.id,
          student_id: student.id,
          hostel_id: targetHostel.id,
          year_of_study: year,
          is_renewal: false,
          accessibility_needs: Boolean(accessibility_needs),
          accessibility_details: accessibility_details || null,
          status: 'PENDING',
        },
        include: {
          window: {
            select: { id: true, academic_year: true, semester: true, status: true },
          },
          hostel: {
            select: { id: true, name: true, code: true },
          },
        },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          actor_id: user.id,
          actor_type: 'USER',
          action: 'STUDENT_REGISTRATION_AND_LOTTERY_APPLICATION',
          target_type: 'Student',
          target_id: student.id,
          meta: {
            hostel_code: targetHostel.code,
            year,
            accessibility: Boolean(accessibility_needs),
          },
        },
      });

      // Issue tokens
      const accessToken = generateAccessToken(user);
      const rawRefreshToken = generateRefreshToken();
      const tokenHash = hashToken(rawRefreshToken);

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await tx.refreshToken.create({
        data: {
          user_id: user.id,
          token_hash: tokenHash,
          expires_at: expiresAt,
        },
      });

      return { user, student, application, accessToken, rawRefreshToken };
    });

    const { password_hash: _, ...safeUser } = result.user;

    return res.status(201).json({
      message: 'Registration successful! You have been entered into the hostel room lottery.',
      accessToken: result.accessToken,
      refreshToken: result.rawRefreshToken,
      user: {
        ...safeUser,
        student: result.student,
      },
      application: result.application,
    });
  } catch (error) {
    console.error('registerStudentWithLottery error:', error);
    return res.status(500).json({ error: 'Internal server error during registration' });
  }
}
