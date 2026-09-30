import crypto from 'crypto';
import bcrypt from 'bcrypt';
import prisma from '../prisma.js';

// Helper to hash token using SHA-256
const hashToken = (token) => crypto.createHash('sha256').update(token.trim()).digest('hex');

/**
 * Super Admin creates a staff invite directly for Warden or Mess Admin
 * POST /api/staff/invites
 */
export async function createStaffInvite(req, res) {
  try {
    const { name, email, phone, employee_id, role, target_hostel_ids, target_mess_ids } = req.body;

    if (!name || !email || !employee_id || !role) {
      return res.status(400).json({ error: 'Name, email, employee ID, and role are required.' });
    }

    if (!['WARDEN', 'MESS_ADMIN'].includes(role)) {
      return res.status(400).json({
        error: 'Direct provisioning by Super Admin is for WARDEN or MESS_ADMIN. Vice Warden & Caretaker must be nominated.',
      });
    }

    if (role === 'WARDEN' && (!target_hostel_ids || !Array.isArray(target_hostel_ids) || target_hostel_ids.length === 0)) {
      return res.status(400).json({ error: 'At least one target hostel is required for Warden appointment.' });
    }

    if (role === 'MESS_ADMIN' && (!target_mess_ids || !Array.isArray(target_mess_ids) || target_mess_ids.length === 0)) {
      return res.status(400).json({ error: 'At least one target mess is required for Mess Admin appointment.' });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check if there is already a pending invite for this email
    const existingPendingInvite = await prisma.staffInvite.findFirst({
      where: {
        email: cleanEmail,
        status: 'PENDING',
        expires_at: { gt: new Date() },
      },
    });

    if (existingPendingInvite) {
      return res.status(409).json({
        error: `An active invite is already pending for ${cleanEmail}. You can resend or regenerate the existing invite.`,
        inviteId: existingPendingInvite.id,
      });
    }

    // Generate 32-byte crypto token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 hours

    const invite = await prisma.staffInvite.create({
      data: {
        created_by: req.user.id,
        role,
        name: name.trim(),
        email: cleanEmail,
        phone: phone ? phone.trim() : null,
        employee_id: employee_id.trim(),
        token_hash: tokenHash,
        expires_at: expiresAt,
        status: 'PENDING',
        target_hostel_ids: target_hostel_ids || null,
        target_mess_ids: target_mess_ids || null,
      },
    });

    await prisma.auditLog.create({
      data: {
        actor_id: req.user.id,
        actor_type: 'USER',
        action: 'STAFF_INVITE_CREATED',
        target_type: 'StaffInvite',
        target_id: invite.id,
        meta: { email: cleanEmail, role, employee_id },
      },
    });

    const acceptUrl = `/accept-invite?token=${rawToken}`;

    return res.status(201).json({
      message: `${role} invitation created successfully. Send the one-time activation link to the appointee.`,
      invite,
      token: rawToken,
      accept_url: acceptUrl,
    });
  } catch (error) {
    console.error('Error creating staff invite:', error);
    return res.status(500).json({ error: 'Failed to create staff invite.' });
  }
}

/**
 * Super Admin lists all staff invites
 * GET /api/staff/invites
 */
export async function listStaffInvites(req, res) {
  try {
    const { status, role } = req.query;

    // Automatically transition expired pending invites
    await prisma.staffInvite.updateMany({
      where: {
        status: 'PENDING',
        expires_at: { lt: new Date() },
      },
      data: { status: 'EXPIRED' },
    });

    const where = {};
    if (status) where.status = status;
    if (role) where.role = role;

    const invites = await prisma.staffInvite.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include: {
        creator: { select: { id: true, name: true, email: true } },
        source_nomination: {
          include: {
            nominator: { select: { id: true, name: true, email: true } },
            hostel: { select: { id: true, name: true, code: true } },
          },
        },
        accepted_user: { select: { id: true, name: true, email: true } },
      },
    });

    return res.json({ invites });
  } catch (error) {
    console.error('Error listing staff invites:', error);
    return res.status(500).json({ error: 'Failed to fetch staff invites.' });
  }
}

/**
 * Super Admin regenerates a staff invite (resets expiry & produces fresh token)
 * POST /api/staff/invites/:id/regenerate
 */
export async function regenerateStaffInvite(req, res) {
  try {
    const { id } = req.params;

    const existing = await prisma.staffInvite.findUnique({
      where: { id },
      include: { source_nomination: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Staff invite not found.' });
    }

    if (existing.status === 'ACCEPTED') {
      return res.status(400).json({ error: 'Cannot regenerate an invite that has already been accepted.' });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

    const updated = await prisma.staffInvite.update({
      where: { id },
      data: {
        token_hash: tokenHash,
        expires_at: expiresAt,
        status: 'PENDING',
      },
    });

    await prisma.auditLog.create({
      data: {
        actor_id: req.user.id,
        actor_type: 'USER',
        action: 'STAFF_INVITE_REGENERATED',
        target_type: 'StaffInvite',
        target_id: updated.id,
        meta: { email: updated.email, role: updated.role },
      },
    });

    const acceptUrl = `/accept-invite?token=${rawToken}`;

    return res.json({
      message: 'Fresh invitation token generated successfully.',
      invite: updated,
      token: rawToken,
      accept_url: acceptUrl,
    });
  } catch (error) {
    console.error('Error regenerating staff invite:', error);
    return res.status(500).json({ error: 'Failed to regenerate staff invite.' });
  }
}

/**
 * Warden nominates Vice Warden or Caretaker for their assigned hostel
 * POST /api/staff/nominations
 */
export async function createNomination(req, res) {
  try {
    const { name, email, phone, employee_id, role, hostel_id } = req.body;

    if (!name || !email || !employee_id || !role || !hostel_id) {
      return res.status(400).json({ error: 'Name, email, employee ID, role, and hostel are required.' });
    }

    if (!['VICE_WARDEN', 'CARETAKER'].includes(role)) {
      return res.status(400).json({ error: 'Nominations are strictly for VICE_WARDEN or CARETAKER roles.' });
    }

    // Server-side validation: if Warden, MUST be assigned to this hostel
    if (req.user.role === 'WARDEN') {
      const activeAssignments = req.user.staff_hostel_assignments || [];
      const isAssigned = activeAssignments.some((a) => a.hostel_id === hostel_id && !a.end_date);

      if (!isAssigned) {
        return res.status(403).json({
          error: 'Access denied: Wardens can only nominate staff for their own currently assigned hostel(s).',
        });
      }
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check if pending nomination exists for this email & hostel
    const existingNomination = await prisma.staffNomination.findFirst({
      where: {
        email: cleanEmail,
        hostel_id,
        status: 'PENDING',
      },
    });

    if (existingNomination) {
      return res.status(409).json({
        error: `A nomination for ${cleanEmail} at this hostel is already pending review by Super Admin.`,
      });
    }

    const nomination = await prisma.staffNomination.create({
      data: {
        nominated_by: req.user.id,
        hostel_id,
        role,
        name: name.trim(),
        email: cleanEmail,
        phone: phone ? phone.trim() : null,
        employee_id: employee_id.trim(),
        status: 'PENDING',
      },
      include: {
        hostel: { select: { id: true, name: true, code: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        actor_id: req.user.id,
        actor_type: 'USER',
        action: 'STAFF_NOMINATION_SUBMITTED',
        target_type: 'StaffNomination',
        target_id: nomination.id,
        meta: { email: cleanEmail, role, hostel_id },
      },
    });

    return res.status(201).json({
      message: `Nomination for ${role} submitted successfully. Awaiting Super Admin review and approval.`,
      nomination,
    });
  } catch (error) {
    console.error('Error creating staff nomination:', error);
    return res.status(500).json({ error: 'Failed to submit staff nomination.' });
  }
}

/**
 * List staff nominations (Super Admin views all; Warden views nominations for their scope)
 * GET /api/staff/nominations
 */
export async function listNominations(req, res) {
  try {
    const { status, hostel_id } = req.query;
    const where = {};

    if (req.user.role === 'WARDEN') {
      const activeHostelIds = (req.user.staff_hostel_assignments || [])
        .filter((a) => !a.end_date)
        .map((a) => a.hostel_id);

      where.OR = [
        { nominated_by: req.user.id },
        { hostel_id: { in: activeHostelIds } },
      ];
    }

    if (status) where.status = status;
    if (hostel_id) where.hostel_id = hostel_id;

    const nominations = await prisma.staffNomination.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include: {
        hostel: { select: { id: true, name: true, code: true } },
        nominator: { select: { id: true, name: true, email: true } },
        reviewer: { select: { id: true, name: true, email: true } },
        invite: {
          select: {
            id: true,
            status: true,
            expires_at: true,
            accepted_at: true,
          },
        },
      },
    });

    return res.json({ nominations });
  } catch (error) {
    console.error('Error listing staff nominations:', error);
    return res.status(500).json({ error: 'Failed to fetch staff nominations.' });
  }
}

/**
 * Super Admin approves a staff nomination and generates an invite
 * POST /api/staff/nominations/:id/approve
 */
export async function approveNomination(req, res) {
  try {
    const { id } = req.params;

    const nomination = await prisma.staffNomination.findUnique({
      where: { id },
      include: { hostel: true },
    });

    if (!nomination) {
      return res.status(404).json({ error: 'Nomination not found.' });
    }

    if (nomination.status !== 'PENDING') {
      return res.status(400).json({ error: `Nomination cannot be approved: current status is ${nomination.status}.` });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

    const [updatedNomination, invite] = await prisma.$transaction([
      prisma.staffNomination.update({
        where: { id },
        data: {
          status: 'APPROVED',
          reviewed_by: req.user.id,
          reviewed_at: new Date(),
        },
      }),
      prisma.staffInvite.create({
        data: {
          source_nomination_id: nomination.id,
          created_by: req.user.id,
          role: nomination.role,
          name: nomination.name,
          email: nomination.email,
          phone: nomination.phone,
          employee_id: nomination.employee_id,
          token_hash: tokenHash,
          expires_at: expiresAt,
          status: 'PENDING',
          target_hostel_ids: [nomination.hostel_id],
        },
      }),
      prisma.auditLog.create({
        data: {
          actor_id: req.user.id,
          actor_type: 'USER',
          action: 'STAFF_NOMINATION_APPROVED',
          target_type: 'StaffNomination',
          target_id: nomination.id,
          meta: { email: nomination.email, role: nomination.role, hostel_id: nomination.hostel_id },
        },
      }),
    ]);

    const acceptUrl = `/accept-invite?token=${rawToken}`;

    return res.json({
      message: `Nomination approved! One-time invitation link generated for ${nomination.name}.`,
      nomination: updatedNomination,
      invite,
      token: rawToken,
      accept_url: acceptUrl,
    });
  } catch (error) {
    console.error('Error approving staff nomination:', error);
    return res.status(500).json({ error: 'Failed to approve nomination.' });
  }
}

/**
 * Super Admin rejects a staff nomination with mandatory note
 * POST /api/staff/nominations/:id/reject
 */
export async function rejectNomination(req, res) {
  try {
    const { id } = req.params;
    const { review_note } = req.body;

    if (!review_note || !review_note.trim()) {
      return res.status(400).json({ error: 'A review note explaining the reason is required for rejection.' });
    }

    const nomination = await prisma.staffNomination.findUnique({
      where: { id },
    });

    if (!nomination) {
      return res.status(404).json({ error: 'Nomination not found.' });
    }

    if (nomination.status !== 'PENDING') {
      return res.status(400).json({ error: `Nomination cannot be rejected: current status is ${nomination.status}.` });
    }

    const updated = await prisma.staffNomination.update({
      where: { id },
      data: {
        status: 'REJECTED',
        review_note: review_note.trim(),
        reviewed_by: req.user.id,
        reviewed_at: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        actor_id: req.user.id,
        actor_type: 'USER',
        action: 'STAFF_NOMINATION_REJECTED',
        target_type: 'StaffNomination',
        target_id: nomination.id,
        meta: { email: nomination.email, reason: review_note.trim() },
      },
    });

    return res.json({
      message: 'Nomination has been rejected. The nominating Warden can view your review note.',
      nomination: updated,
    });
  } catch (error) {
    console.error('Error rejecting staff nomination:', error);
    return res.status(500).json({ error: 'Failed to reject nomination.' });
  }
}

/**
 * Public: Verify invite token details before account activation
 * GET /api/staff/invites/verify
 */
export async function verifyStaffInvite(req, res) {
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Invite token is required.' });
    }

    const tokenHash = hashToken(token);

    const invite = await prisma.staffInvite.findUnique({
      where: { token_hash: tokenHash },
    });

    if (!invite) {
      return res.status(404).json({ error: 'Invalid or unknown invite token.' });
    }

    if (invite.status !== 'PENDING') {
      return res.status(400).json({
        error: `This invitation has already been ${invite.status.toLowerCase()}. Please contact administration.`,
        status: invite.status,
      });
    }

    if (new Date() > invite.expires_at) {
      await prisma.staffInvite.update({
        where: { id: invite.id },
        data: { status: 'EXPIRED' },
      });

      return res.status(400).json({
        error: 'This invitation token has expired (valid for 72 hours). Please request a fresh invitation link from administration.',
        status: 'EXPIRED',
      });
    }

    // Resolve hostel / mess names
    let hostels = [];
    if (invite.target_hostel_ids && Array.isArray(invite.target_hostel_ids)) {
      hostels = await prisma.hostel.findMany({
        where: { id: { in: invite.target_hostel_ids } },
        select: { id: true, name: true, code: true, type: true },
      });
    }

    let messes = [];
    if (invite.target_mess_ids && Array.isArray(invite.target_mess_ids)) {
      messes = await prisma.mess.findMany({
        where: { id: { in: invite.target_mess_ids } },
        select: { id: true, name: true },
      });
    }

    return res.json({
      valid: true,
      invite: {
        id: invite.id,
        role: invite.role,
        name: invite.name,
        email: invite.email,
        employee_id: invite.employee_id,
        expires_at: invite.expires_at,
        hostels,
        messes,
      },
    });
  } catch (error) {
    console.error('Error verifying staff invite:', error);
    return res.status(500).json({ error: 'Failed to verify staff invitation.' });
  }
}

/**
 * Public: Accept staff invite and set initial password
 * POST /api/staff/invites/accept
 */
export async function acceptStaffInvite(req, res) {
  try {
    const { token, password } = req.body;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Invite token is required.' });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    const tokenHash = hashToken(token);

    const invite = await prisma.staffInvite.findUnique({
      where: { token_hash: tokenHash },
    });

    if (!invite) {
      return res.status(404).json({ error: 'Invalid or unknown invite token.' });
    }

    if (invite.status !== 'PENDING') {
      return res.status(400).json({ error: `Invite is already ${invite.status.toLowerCase()}.` });
    }

    if (new Date() > invite.expires_at) {
      await prisma.staffInvite.update({
        where: { id: invite.id },
        data: { status: 'EXPIRED' },
      });
      return res.status(400).json({ error: 'Invite token has expired.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await prisma.$transaction(async (tx) => {
      // Find or create User
      let user = await tx.user.findUnique({
        where: { email: invite.email },
      });

      if (user) {
        user = await tx.user.update({
          where: { id: user.id },
          data: {
            name: invite.name,
            password_hash: passwordHash,
            role: invite.role,
            phone: invite.phone || user.phone,
            employee_id: invite.employee_id || user.employee_id,
            is_active: true,
          },
        });
      } else {
        user = await tx.user.create({
          data: {
            name: invite.name,
            email: invite.email,
            password_hash: passwordHash,
            role: invite.role,
            phone: invite.phone,
            employee_id: invite.employee_id,
            is_active: true,
          },
        });
      }

      // Assign to Hostels
      if (invite.target_hostel_ids && Array.isArray(invite.target_hostel_ids)) {
        for (let i = 0; i < invite.target_hostel_ids.length; i++) {
          const hostelId = invite.target_hostel_ids[i];
          const existingAssignment = await tx.staffHostelAssignment.findFirst({
            where: { user_id: user.id, hostel_id: hostelId, end_date: null },
          });

          if (!existingAssignment) {
            await tx.staffHostelAssignment.create({
              data: {
                user_id: user.id,
                hostel_id: hostelId,
                role: invite.role,
                is_primary: i === 0,
                assigned_by: invite.created_by,
                end_date: null,
              },
            });
          }
        }
      }

      // Assign to Messes
      if (invite.target_mess_ids && Array.isArray(invite.target_mess_ids)) {
        for (let i = 0; i < invite.target_mess_ids.length; i++) {
          const messId = invite.target_mess_ids[i];
          const existingAssignment = await tx.staffMessAssignment.findFirst({
            where: { user_id: user.id, mess_id: messId, end_date: null },
          });

          if (!existingAssignment) {
            await tx.staffMessAssignment.create({
              data: {
                user_id: user.id,
                mess_id: messId,
                role: invite.role,
                assigned_by: invite.created_by,
                end_date: null,
              },
            });
          }
        }
      }

      // Mark invite as ACCEPTED
      const updatedInvite = await tx.staffInvite.update({
        where: { id: invite.id },
        data: {
          status: 'ACCEPTED',
          accepted_user_id: user.id,
          accepted_at: new Date(),
        },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          actor_id: user.id,
          actor_type: 'USER',
          action: 'STAFF_INVITE_ACCEPTED',
          target_type: 'User',
          target_id: user.id,
          meta: { email: user.email, role: user.role, inviteId: invite.id },
        },
      });

      return { user, invite: updatedInvite };
    });

    return res.json({
      message: `Account activated successfully! Welcome to HOSTEL360 as ${result.user.role}. You can now log in.`,
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
      },
    });
  } catch (error) {
    console.error('Error accepting staff invite:', error);
    return res.status(500).json({ error: 'Failed to accept invitation and activate account.' });
  }
}

/**
 * End a staff member's hostel assignment (Super Admin: any assignment; Warden: Vice Warden/Caretaker in their own hostel)
 * POST /api/staff/assignments/hostel/:id/end
 */
export async function endHostelAssignment(req, res) {
  try {
    const { id } = req.params;
    const { end_reason } = req.body;

    const assignment = await prisma.staffHostelAssignment.findUnique({
      where: { id },
      include: {
        user: true,
        hostel: true,
      },
    });

    if (!assignment) {
      return res.status(404).json({ error: 'Staff hostel assignment not found.' });
    }

    if (assignment.end_date) {
      return res.status(400).json({ error: 'This assignment has already been ended.' });
    }

    // Role & scoping validation
    if (req.user.role === 'WARDEN') {
      // 1. Cannot end a Warden assignment (including their own)
      if (assignment.role === 'WARDEN' || assignment.user_id === req.user.id) {
        return res.status(403).json({
          error: 'Access denied: A Warden cannot end a Warden assignment (including their own). Only Super Admin can do so.',
        });
      }

      // 2. Can only end VICE_WARDEN or CARETAKER
      if (!['VICE_WARDEN', 'CARETAKER'].includes(assignment.role)) {
        return res.status(403).json({
          error: 'Access denied: Wardens can only end Vice Warden or Caretaker assignments.',
        });
      }

      // 3. Must be within Warden's own currently assigned hostels
      const activeAssignments = req.user.staff_hostel_assignments || [];
      const isAssigned = activeAssignments.some((a) => a.hostel_id === assignment.hostel_id && !a.end_date);

      if (!isAssigned) {
        return res.status(403).json({
          error: 'Access denied: You can only end staff assignments within your own assigned hostel(s).',
        });
      }
    } else if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const now = new Date();

    const [updated] = await prisma.$transaction([
      // 1. End assignment
      prisma.staffHostelAssignment.update({
        where: { id },
        data: {
          end_date: now,
          ended_by: req.user.id,
          end_reason: end_reason?.trim() || 'Staff assignment ended by administration',
        },
      }),

      // 2. Immediately revoke target user's active refresh tokens
      prisma.refreshToken.updateMany({
        where: {
          user_id: assignment.user_id,
          revoked_at: null,
        },
        data: {
          revoked_at: now,
        },
      }),

      // 3. Audit log
      prisma.auditLog.create({
        data: {
          actor_id: req.user.id,
          actor_type: 'USER',
          action: 'STAFF_HOSTEL_ASSIGNMENT_ENDED',
          target_type: 'StaffHostelAssignment',
          target_id: assignment.id,
          meta: {
            user_id: assignment.user_id,
            hostel_id: assignment.hostel_id,
            role: assignment.role,
            reason: end_reason || 'Staff assignment ended',
          },
        },
      }),
    ]);

    return res.json({
      message: `Assignment for ${assignment.user.name} (${assignment.role}) ended successfully. All active sessions immediately revoked.`,
      assignment: updated,
    });
  } catch (error) {
    console.error('Error ending hostel assignment:', error);
    return res.status(500).json({ error: 'Failed to end hostel assignment.' });
  }
}

/**
 * End a staff member's mess assignment (Super Admin only)
 * POST /api/staff/assignments/mess/:id/end
 */
export async function endMessAssignment(req, res) {
  try {
    const { id } = req.params;
    const { end_reason } = req.body;

    const assignment = await prisma.staffMessAssignment.findUnique({
      where: { id },
      include: {
        user: true,
        mess: true,
      },
    });

    if (!assignment) {
      return res.status(404).json({ error: 'Staff mess assignment not found.' });
    }

    if (assignment.end_date) {
      return res.status(400).json({ error: 'This mess assignment has already been ended.' });
    }

    const now = new Date();

    const [updated] = await prisma.$transaction([
      prisma.staffMessAssignment.update({
        where: { id },
        data: {
          end_date: now,
          ended_by: req.user.id,
          end_reason: end_reason?.trim() || 'Mess staff assignment ended by Super Admin',
        },
      }),
      prisma.refreshToken.updateMany({
        where: {
          user_id: assignment.user_id,
          revoked_at: null,
        },
        data: {
          revoked_at: now,
        },
      }),
      prisma.auditLog.create({
        data: {
          actor_id: req.user.id,
          actor_type: 'USER',
          action: 'STAFF_MESS_ASSIGNMENT_ENDED',
          target_type: 'StaffMessAssignment',
          target_id: assignment.id,
          meta: {
            user_id: assignment.user_id,
            mess_id: assignment.mess_id,
            role: assignment.role,
            reason: end_reason || 'Mess assignment ended',
          },
        },
      }),
    ]);

    return res.json({
      message: `Mess assignment for ${assignment.user.name} ended successfully. All active sessions immediately revoked.`,
      assignment: updated,
    });
  } catch (error) {
    console.error('Error ending mess assignment:', error);
    return res.status(500).json({ error: 'Failed to end mess assignment.' });
  }
}

/**
 * List all staff assignments across hostels and messes with status filters
 * GET /api/staff/assignments
 */
export async function listStaffAssignments(req, res) {
  try {
    const { status, hostel_id, role, type } = req.query;

    let hostelWhere = {};
    let messWhere = {};

    if (status === 'active') {
      hostelWhere.end_date = null;
      messWhere.end_date = null;
    } else if (status === 'ended') {
      hostelWhere.end_date = { not: null };
      messWhere.end_date = { not: null };
    }

    if (role) {
      hostelWhere.role = role;
      messWhere.role = role;
    }

    if (hostel_id) {
      hostelWhere.hostel_id = hostel_id;
    }

    // Warden scoping
    if (req.user.role === 'WARDEN') {
      const activeHostelIds = (req.user.staff_hostel_assignments || [])
        .filter((a) => !a.end_date)
        .map((a) => a.hostel_id);

      hostelWhere.hostel_id = { in: activeHostelIds };
      messWhere = null; // Wardens do not manage mess staff
    }

    let hostelAssignments = [];
    if (type !== 'mess') {
      hostelAssignments = await prisma.staffHostelAssignment.findMany({
        where: hostelWhere,
        orderBy: [{ end_date: 'asc' }, { assigned_at: 'desc' }],
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              employee_id: true,
              role: true,
              is_active: true,
            },
          },
          hostel: { select: { id: true, name: true, code: true, type: true } },
          assigned_by_user: { select: { id: true, name: true, email: true } },
          ended_by_user: { select: { id: true, name: true, email: true } },
        },
      });
    }

    let messAssignments = [];
    if (type !== 'hostel' && messWhere) {
      messAssignments = await prisma.staffMessAssignment.findMany({
        where: messWhere,
        orderBy: [{ end_date: 'asc' }, { assigned_at: 'desc' }],
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              employee_id: true,
              role: true,
              is_active: true,
            },
          },
          mess: { select: { id: true, name: true } },
          assigned_by_user: { select: { id: true, name: true, email: true } },
          ended_by_user: { select: { id: true, name: true, email: true } },
        },
      });
    }

    return res.json({
      hostel_assignments: hostelAssignments,
      mess_assignments: messAssignments,
      total_active_hostel: hostelAssignments.filter((a) => !a.end_date).length,
      total_active_mess: messAssignments.filter((a) => !a.end_date).length,
    });
  } catch (error) {
    console.error('Error listing staff assignments:', error);
    return res.status(500).json({ error: 'Failed to fetch staff assignments.' });
  }
}
