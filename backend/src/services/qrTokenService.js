import crypto from 'crypto';
import prisma from '../prisma.js';
import { hashToken } from '../utils/token.js';

import { resolveMealWindow } from './mealWindowService.js';

/**
 * Returns the currently active meal window for a given mess, based on current time.
 * @param {string} messId
 * @param {Date} [now]
 * @returns {Promise<object|null>}
 */
export async function getActiveMealWindow(messId, now = new Date()) {
  const resolved = await resolveMealWindow(messId, now);
  return resolved.active;
}

/**
 * Generates a 32-byte opaque QR token for a device and stores its SHA-256 hash.
 * Invalidates previous UNUSED tokens for this device to maintain 1 active token at a time.
 * @param {object} device - Authenticated device object
 * @returns {Promise<{ token: string, expires_at: Date, ttl: number, record: object }>}
 */
export async function generateQrToken(deviceOrId) {
  let device = deviceOrId;
  if (typeof deviceOrId === 'string') {
    device = await prisma.device.findUnique({ where: { id: deviceOrId } });
    if (!device) {
      throw new Error(`Device with ID ${deviceOrId} not found`);
    }
  }

  const ttlSeconds = parseInt(process.env.QR_TTL_SECONDS || '20', 10);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

  // Generate 32-byte cryptographically random token (64 hex characters)
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);

  // Invalidate any previously UNUSED tokens for this device to prevent race conditions
  await prisma.qrToken.updateMany({
    where: {
      device_id: device.id,
      status: 'UNUSED',
    },
    data: {
      status: 'REVOKED',
    },
  });

  // Resolve active and upcoming meal windows if device purpose is MESS
  let activeMealWindow = null;
  let nextMealWindow = null;
  let allMealWindows = [];
  if (device.purpose === 'MESS' && device.mess_id) {
    const resolved = await resolveMealWindow(device.mess_id, now);
    activeMealWindow = resolved.active;
    nextMealWindow = resolved.next;
    allMealWindows = resolved.allWindows;
  }

  // Create QR token record in database with SHA-256 hash only
  const record = await prisma.qrToken.create({
    data: {
      token_hash: tokenHash,
      device_id: device.id,
      purpose: device.purpose,
      gate_id: device.purpose === 'GATE' ? device.gate_id : null,
      mess_id: device.purpose === 'MESS' ? device.mess_id : null,
      meal_window_id: activeMealWindow ? activeMealWindow.id : null,
      status: 'UNUSED',
      expires_at: expiresAt,
    },
    include: {
      gate: {
        include: {
          hostel: true,
        },
      },
      mess: true,
      meal_window: true,
    },
  });

  return {
    token: rawToken,
    expires_at: expiresAt,
    ttl: ttlSeconds,
    record,
    meal_window: activeMealWindow,
    next_meal_window: nextMealWindow,
    all_meal_windows: allMealWindows,
  };
}

/**
 * Validates a raw QR token and atomically marks it as USED.
 * Enforces: existence, non-reuse (UNUSED only), non-expired, active device, and optional deviceId binding.
 * @param {string} rawToken - 32-byte raw hex token scanned by student
 * @param {string} [deviceId] - Optional deviceId to verify binding
 * @returns {Promise<{ valid: boolean, token?: object, code?: string, error?: string }>}
 */
export async function validateAndConsume(rawToken, deviceId = null) {
  if (!rawToken || typeof rawToken !== 'string') {
    return { valid: false, code: 'INVALID_INPUT', error: 'Token string is required' };
  }

  const tokenHash = hashToken(rawToken);

  return await prisma.$transaction(async (tx) => {
    const qrToken = await tx.qrToken.findUnique({
      where: { token_hash: tokenHash },
      include: {
        device: true,
        gate: {
          include: {
            hostel: true,
          },
        },
        mess: true,
        meal_window: true,
      },
    });

    if (!qrToken) {
      return { valid: false, code: 'TOKEN_NOT_FOUND', error: 'Invalid or unknown QR token' };
    }

    if (qrToken.status === 'USED') {
      return { valid: false, code: 'TOKEN_ALREADY_USED', error: 'QR token has already been used' };
    }

    if (qrToken.status === 'REVOKED') {
      return { valid: false, code: 'TOKEN_REVOKED', error: 'QR token has been revoked by device rotation' };
    }

    const now = new Date();
    if (qrToken.status === 'EXPIRED' || now > qrToken.expires_at) {
      if (qrToken.status !== 'EXPIRED') {
        await tx.qrToken.update({
          where: { id: qrToken.id },
          data: { status: 'EXPIRED' },
        });
      }
      return { valid: false, code: 'TOKEN_EXPIRED', error: 'QR token has expired' };
    }

    if (!qrToken.device || !qrToken.device.is_active) {
      return { valid: false, code: 'DEVICE_INACTIVE', error: 'Associated device is disabled or inactive' };
    }

    if (deviceId && qrToken.device_id !== deviceId) {
      return { valid: false, code: 'DEVICE_MISMATCH', error: 'QR token does not belong to specified device' };
    }

    // Atomically transition status to USED
    const consumedToken = await tx.qrToken.update({
      where: { id: qrToken.id },
      data: {
        status: 'USED',
        used_at: now,
      },
      include: {
        device: true,
        gate: {
          include: {
            hostel: true,
          },
        },
        mess: true,
        meal_window: true,
      },
    });

    return {
      valid: true,
      token: consumedToken,
    };
  });
}

/**
 * Sweeper task function: Bulk-updates expired UNUSED tokens to EXPIRED.
 * @returns {Promise<number>} Number of tokens updated
 */
export async function sweepExpiredTokens() {
  const now = new Date();
  const result = await prisma.qrToken.updateMany({
    where: {
      status: 'UNUSED',
      expires_at: { lt: now },
    },
    data: {
      status: 'EXPIRED',
    },
  });

  return result.count;
}
