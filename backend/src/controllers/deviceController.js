import crypto from 'crypto';
import bcrypt from 'bcrypt';
import prisma from '../prisma.js';

// 3.1 Device registration endpoint
export async function registerDevice(req, res) {
  try {
    const { device_name, device_code, purpose, gate_id, mess_id } = req.body;

    if (!device_name || !purpose) {
      return res.status(400).json({ error: 'device_name and purpose (GATE or MESS) are required' });
    }

    if (!['GATE', 'MESS'].includes(purpose)) {
      return res.status(400).json({ error: 'Invalid purpose. Must be GATE or MESS' });
    }

    if (purpose === 'GATE' && !gate_id) {
      return res.status(400).json({ error: 'gate_id is required for GATE purpose devices' });
    }

    if (purpose === 'MESS' && !mess_id) {
      return res.status(400).json({ error: 'mess_id is required for MESS purpose devices' });
    }

    // Generate 32-byte cryptographically random secret
    const rawSecret = crypto.randomBytes(32).toString('hex');
    const salt = await bcrypt.genSalt(10);
    const secretHash = await bcrypt.hash(rawSecret, salt);

    // Create device and audit log atomically in a transaction
    const [device] = await prisma.$transaction([
      prisma.device.create({
        data: {
          device_name,
          device_code: device_code || null,
          purpose,
          gate_id: purpose === 'GATE' ? gate_id : null,
          mess_id: purpose === 'MESS' ? mess_id : null,
          secret_hash: secretHash,
          is_active: true,
          registered_by: req.user.id,
        },
        include: {
          gate: {
            include: { hostel: true },
          },
          mess: true,
        },
      }),
      prisma.auditLog.create({
        data: {
          actor_id: req.user.id,
          actor_type: 'USER',
          action: 'DEVICE_REGISTERED',
          target_type: 'Device',
          meta: {
            deviceName: device_name,
            deviceCode: device_code,
            purpose,
          },
        },
      }),
    ]);

    // Omit secret_hash from response, return plaintext secret once
    const { secret_hash, ...safeDevice } = device;

    return res.status(201).json({
      message: 'Device registered successfully. Save the device secret now; it will never be displayed again.',
      device: safeDevice,
      secret: rawSecret,
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'A device with this device_code already exists' });
    }
    console.error('Register device error:', error);
    return res.status(500).json({ error: 'Internal server error registering device' });
  }
}

// 3.2 Device list endpoint
export async function listDevices(req, res) {
  try {
    const devices = await prisma.device.findMany({
      select: {
        id: true,
        device_code: true,
        device_name: true,
        purpose: true,
        is_active: true,
        last_heartbeat_at: true,
        created_at: true,
        gate: {
          select: {
            id: true,
            name: true,
            hostel: {
              select: { id: true, name: true, code: true },
            },
          },
        },
        mess: {
          select: {
            id: true,
            name: true,
          },
        },
        registrant: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return res.json({ devices });
  } catch (error) {
    console.error('List devices error:', error);
    return res.status(500).json({ error: 'Internal server error fetching devices' });
  }
}
