import bcrypt from 'bcrypt';
import prisma from '../prisma.js';
import { generateAccessToken, generateRefreshToken, hashToken } from '../utils/token.js';

export async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

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
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

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
    const { refreshToken } = req.body;
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
