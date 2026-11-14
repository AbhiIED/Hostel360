import crypto from 'crypto';
import bcrypt from 'bcrypt';
import prisma from '../prisma.js';
import { generateQrToken } from '../services/qrTokenService.js';

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
      const target = error.meta?.target || '';
      if (String(target).includes('secret_hash')) {
        return res.status(409).json({ error: 'Device secret hash collision: two devices cannot share identical secrets' });
      }
      return res.status(409).json({ error: 'A device with this device_code or secret already exists' });
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
            hostel_id: true,
            hostel: {
              select: { id: true, name: true, code: true, type: true },
            },
          },
        },
        mess: {
          select: {
            id: true,
            name: true,
            hostel_id: true,
            hostel: {
              select: { id: true, name: true, code: true, type: true },
            },
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

// 3.4 Heartbeat endpoint (Device authenticated)
export async function heartbeat(req, res) {
  try {
    const now = new Date();

    await prisma.device.update({
      where: { id: req.device.id },
      data: { last_heartbeat_at: now },
    });

    // Emit Socket.IO heartbeat event to admin:global room
    const io = req.app.get('io');
    if (io) {
      io.to('admin:global').emit('device:heartbeat', {
        deviceId: req.device.id,
        deviceCode: req.device.device_code,
        deviceName: req.device.device_name,
        timestamp: now.toISOString(),
      });
    }

    return res.json({ ok: true, timestamp: now.toISOString() });
  } catch (error) {
    console.error('Heartbeat error:', error);
    return res.status(500).json({ error: 'Internal server error processing heartbeat' });
  }
}

// 3.5 Disable device endpoint (SUPER_ADMIN)
export async function disableDevice(req, res) {
  try {
    const { id } = req.params;

    const existingDevice = await prisma.device.findUnique({
      where: { id },
    });

    if (!existingDevice) {
      return res.status(404).json({ error: 'Device not found' });
    }

    // Set is_active = false, revoke all UNUSED tokens, write audit log in transaction
    const [updatedDevice] = await prisma.$transaction([
      prisma.device.update({
        where: { id },
        data: { is_active: false },
      }),
      prisma.qrToken.updateMany({
        where: {
          device_id: id,
          status: 'UNUSED',
        },
        data: { status: 'REVOKED' },
      }),
      prisma.auditLog.create({
        data: {
          actor_id: req.user.id,
          actor_type: 'USER',
          action: 'DEVICE_DISABLED',
          target_type: 'Device',
          target_id: id,
          meta: {
            deviceName: existingDevice.device_name,
            deviceCode: existingDevice.device_code,
          },
        },
      }),
    ]);

    // Emit alert to admin:global room
    const io = req.app.get('io');
    if (io) {
      io.to('admin:global').emit('device:alert', {
        deviceId: id,
        deviceCode: existingDevice.device_code,
        deviceName: existingDevice.device_name,
        reason: 'REVOKED',
        timestamp: new Date().toISOString(),
      });
    }

    return res.json({
      message: 'Device disabled and active QR tokens revoked successfully',
      device: updatedDevice,
    });
  } catch (error) {
    console.error('Disable device error:', error);
    return res.status(500).json({ error: 'Internal server error disabling device' });
  }
}

// B.1 Caretaker/Warden scoped devices list
export async function listMyKiosks(req, res) {
  try {
    let whereCondition = {};
    if (req.user.role !== 'SUPER_ADMIN') {
      const assignedHostelIds = req.user.staff_hostel_assignments?.map((a) => a.hostel_id) || [];
      if (assignedHostelIds.length === 0) {
        return res.json({ devices: [] });
      }
      whereCondition = {
        OR: [
          { gate: { hostel_id: { in: assignedHostelIds } } },
          { mess: { hostel_id: { in: assignedHostelIds } } },
        ],
      };
    }

    const devices = await prisma.device.findMany({
      where: whereCondition,
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
            hostel: {
              select: { id: true, name: true, code: true },
            },
          },
        },
      },
      orderBy: { created_at: 'asc' },
    });

    const now = new Date();
    // Enrich with live status and issuance health
    const enriched = await Promise.all(
      devices.map(async (dev) => {
        const isOnline =
          dev.is_active &&
          dev.last_heartbeat_at &&
          now.getTime() - new Date(dev.last_heartbeat_at).getTime() < 120000;

        const recentTokenCount = await prisma.qrToken.count({
          where: {
            device_id: dev.id,
            created_at: { gte: new Date(now.getTime() - 15 * 60 * 1000) },
          },
        });

        const lastToken = await prisma.qrToken.findFirst({
          where: { device_id: dev.id },
          orderBy: { created_at: 'desc' },
          select: { created_at: true, status: true },
        });

        return {
          ...dev,
          is_online: isOnline,
          issuance_health: {
            tokens_last_15m: recentTokenCount,
            last_token_at: lastToken?.created_at || null,
            last_token_status: lastToken?.status || null,
          },
        };
      })
    );

    return res.json({ devices: enriched });
  } catch (error) {
    console.error('List my kiosks error:', error);
    return res.status(500).json({ error: 'Internal server error fetching kiosks' });
  }
}

// B.2 Force token refresh (Safe operational action)
export async function forceRefreshToken(req, res) {
  try {
    const { id } = req.params;

    const device = await prisma.device.findUnique({
      where: { id },
      include: {
        gate: true,
        mess: true,
      },
    });

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    // Verify hostel scope for non-Super Admin
    if (req.user.role !== 'SUPER_ADMIN') {
      const assignedHostelIds = req.user.staff_hostel_assignments?.map((a) => a.hostel_id) || [];
      const deviceHostelId = device.gate?.hostel_id || device.mess?.hostel_id;
      if (!deviceHostelId || !assignedHostelIds.includes(deviceHostelId)) {
        return res.status(403).json({ error: 'Access denied: You are not assigned to this device hostel' });
      }
    }

    if (!device.is_active) {
      return res.status(400).json({ error: 'Cannot refresh an inactive or disabled device' });
    }

    // Revoke any existing UNUSED tokens for this device
    await prisma.qrToken.updateMany({
      where: {
        device_id: id,
        status: 'UNUSED',
      },
      data: { status: 'REVOKED' },
    });

    // Write audit log
    await prisma.auditLog.create({
      data: {
        actor_id: req.user.id,
        actor_type: 'USER',
        action: 'DEVICE_FORCE_REFRESH',
        target_type: 'Device',
        target_id: id,
        meta: {
          deviceName: device.device_name,
          deviceCode: device.device_code,
          triggeredByRole: req.user.role,
        },
      },
    });

    // Notify connected kiosk via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to(`device:${device.id}`).emit('device:force_refresh', {
        deviceId: id,
        timestamp: new Date().toISOString(),
        triggeredBy: req.user.name,
      });
    }

    return res.json({
      ok: true,
      message: `Token refresh triggered successfully for ${device.device_name}`,
    });
  } catch (error) {
    console.error('Force refresh error:', error);
    return res.status(500).json({ error: 'Internal server error triggering token refresh' });
  }
}

// B.3 Report malfunction (Super Admin alert without deactivation)
export async function reportMalfunction(req, res) {
  try {
    const { id } = req.params;
    const { note } = req.body;

    if (!note || typeof note !== 'string' || !note.trim()) {
      return res.status(400).json({ error: 'Malfunction note is required' });
    }

    const device = await prisma.device.findUnique({
      where: { id },
      include: {
        gate: true,
        mess: true,
      },
    });

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    // Verify hostel scope for non-Super Admin
    if (req.user.role !== 'SUPER_ADMIN') {
      const assignedHostelIds = req.user.staff_hostel_assignments?.map((a) => a.hostel_id) || [];
      const deviceHostelId = device.gate?.hostel_id || device.mess?.hostel_id;
      if (!deviceHostelId || !assignedHostelIds.includes(deviceHostelId)) {
        return res.status(403).json({ error: 'Access denied: You are not assigned to this device hostel' });
      }
    }

    // Create audit log for Super Admin visibility
    const audit = await prisma.auditLog.create({
      data: {
        actor_id: req.user.id,
        actor_type: 'USER',
        action: 'DEVICE_MALFUNCTION_REPORTED',
        target_type: 'Device',
        target_id: id,
        meta: {
          note: note.trim(),
          deviceName: device.device_name,
          deviceCode: device.device_code,
          reporterName: req.user.name,
          reporterRole: req.user.role,
          reporterEmail: req.user.email,
        },
      },
    });

    // Notify Super Admin room
    const io = req.app.get('io');
    if (io) {
      io.to('admin:global').emit('device:malfunction', {
        deviceId: id,
        deviceCode: device.device_code,
        deviceName: device.device_name,
        note: note.trim(),
        reportedBy: req.user.name,
        timestamp: new Date().toISOString(),
      });
    }

    return res.json({
      ok: true,
      message: 'Malfunction report submitted to Super Admin successfully',
      reportId: audit.id,
    });
  } catch (error) {
    console.error('Report malfunction error:', error);
    return res.status(500).json({ error: 'Internal server error reporting malfunction' });
  }
}

/**
 * GET or POST /api/devices/:id/qr-token
 * Authenticated staff / Super Admin endpoint.
 * Fetches or generates the real-time dynamic QR token for a kiosk display.
 * Allows dashboard view to render live QR codes without needing raw device secrets.
 */
export async function getDeviceQrToken(req, res) {
  try {
    const { id } = req.params;

    const device = await prisma.device.findFirst({
      where: {
        OR: [{ id }, { device_code: id }],
      },
      include: {
        gate: { include: { hostel: true } },
        mess: { include: { hostel: true } },
      },
    });

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    if (!device.is_active) {
      return res.status(403).json({ error: 'This display device has been disabled' });
    }

    // Role-based scoping check for non-Super Admin users
    if (req.user.role !== 'SUPER_ADMIN') {
      const assignedHostelIds = req.user.staff_hostel_assignments?.map((a) => a.hostel_id) || [];
      const assignedMessIds = req.user.staff_mess_assignments?.map((a) => a.mess_id) || [];

      const matchesHostel = device.gate?.hostel_id && assignedHostelIds.includes(device.gate.hostel_id);
      const matchesMessHostel = device.mess?.hostel_id && assignedHostelIds.includes(device.mess.hostel_id);
      const matchesMess = device.mess_id && assignedMessIds.includes(device.mess_id);

      if (!matchesHostel && !matchesMessHostel && !matchesMess) {
        return res.status(403).json({ error: 'You do not have permission to view QR tokens for this device' });
      }
    }

    // Generate real-time dynamic QR token
    const tokenResult = await generateQrToken(device);

    // Update heartbeat asynchronously
    prisma.device.update({
      where: { id: device.id },
      data: { last_heartbeat_at: new Date() },
    }).catch((err) => console.error('Failed to touch heartbeat during QR retrieval:', err));

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
      next_meal_window: tokenResult.next_meal_window,
      all_meal_windows: tokenResult.all_meal_windows,
    });
  } catch (error) {
    console.error('getDeviceQrToken error:', error);
    return res.status(500).json({ error: 'Failed to retrieve QR token for device' });
  }
}


