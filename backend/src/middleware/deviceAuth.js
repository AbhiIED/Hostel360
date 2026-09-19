import bcrypt from 'bcrypt';
import prisma from '../prisma.js';

export async function authenticateDevice(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Device authentication required: missing Bearer token' });
    }

    const secret = authHeader.split(' ')[1];
    const deviceIdHint = req.headers['x-device-id'];
    const deviceCodeHint = req.headers['x-device-code'];

    let candidateDevices = [];

    if (deviceIdHint) {
      const device = await prisma.device.findUnique({
        where: { id: deviceIdHint },
        include: {
          gate: { include: { hostel: true } },
          mess: true,
        },
      });
      if (device) candidateDevices.push(device);
    } else if (deviceCodeHint) {
      const device = await prisma.device.findUnique({
        where: { device_code: deviceCodeHint },
        include: {
          gate: { include: { hostel: true } },
          mess: true,
        },
      });
      if (device) candidateDevices.push(device);
    } else {
      // Fallback: search all active devices
      candidateDevices = await prisma.device.findMany({
        where: { is_active: true },
        include: {
          gate: { include: { hostel: true } },
          mess: true,
        },
      });
    }

    let authenticatedDevice = null;
    for (const dev of candidateDevices) {
      if (!dev.is_active) continue;
      const isMatch = await bcrypt.compare(secret, dev.secret_hash);
      if (isMatch) {
        authenticatedDevice = dev;
        break;
      }
    }

    if (!authenticatedDevice) {
      return res.status(401).json({ error: 'Device authentication failed: invalid secret or device is disabled' });
    }

    // Attach device object without secret_hash
    const { secret_hash, ...safeDevice } = authenticatedDevice;
    req.device = safeDevice;
    next();
  } catch (error) {
    console.error('Device auth middleware error:', error);
    return res.status(500).json({ error: 'Internal server error in device authentication' });
  }
}
