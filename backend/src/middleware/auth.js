import { verifyAccessToken } from '../utils/token.js';
import prisma from '../prisma.js';

export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required: missing Bearer token' });
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Access token expired', code: 'TOKEN_EXPIRED' });
      }
      return res.status(401).json({ error: 'Invalid access token' });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
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
      return res.status(401).json({ error: 'User account is inactive or not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ error: 'Internal server error in authentication' });
  }
}

export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Required role: [${roles.join(', ')}]. Your role: ${req.user.role}`,
      });
    }

    next();
  };
}
