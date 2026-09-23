import prisma from '../prisma.js';
import { generateQrToken } from '../services/qrTokenService.js';

/**
 * GET /api/display/qr
 * Device-authenticated endpoint.
 * Issues a new 32-byte opaque QR token with 20s TTL (or configured env).
 * Invalidates previous unused tokens for this device.
 */
export async function getQrToken(req, res) {
  try {
    const device = req.device;

    if (!device) {
      return res.status(401).json({ error: 'Device authentication required' });
    }

    if (!device.is_active) {
      return res.status(403).json({ error: 'This display device has been disabled' });
    }

    // Generate new QR token
    const tokenResult = await generateQrToken(device);

    // Update device heartbeat asynchronously
    prisma.device.update({
      where: { id: device.id },
      data: { last_heartbeat_at: new Date() },
    }).catch((err) => console.error('Failed to touch heartbeat during QR issuance:', err));

    return res.status(200).json({
      token: tokenResult.token,
      expires_at: tokenResult.expires_at,
      ttl: tokenResult.ttl,
      purpose: device.purpose,
      device: {
        id: device.id,
        device_code: device.device_code,
        device_name: device.device_name,
        purpose: device.purpose,
        gate: tokenResult.record.gate,
        mess: tokenResult.record.mess,
      },
      meal_window: tokenResult.meal_window,
    });
  } catch (error) {
    console.error('Error generating QR token:', error);
    return res.status(500).json({ error: 'Failed to generate QR token' });
  }
}

/**
 * GET /api/display/info/:deviceId
 * Public endpoint to fetch display device metadata for kiosk header/status.
 */
export async function getDisplayInfo(req, res) {
  try {
    const { deviceId } = req.params;

    const device = await prisma.device.findFirst({
      where: {
        OR: [
          { id: deviceId },
          { device_code: deviceId },
        ],
      },
      select: {
        id: true,
        device_code: true,
        device_name: true,
        purpose: true,
        is_active: true,
        last_heartbeat_at: true,
        gate: {
          select: {
            id: true,
            name: true,
            hostel: {
              select: {
                id: true,
                code: true,
                name: true,
                type: true,
              },
            },
          },
        },
        mess: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!device) {
      return res.status(404).json({ error: 'Display device not found' });
    }

    return res.status(200).json({ device });
  } catch (error) {
    console.error('Error fetching display info:', error);
    return res.status(500).json({ error: 'Failed to fetch display info' });
  }
}
