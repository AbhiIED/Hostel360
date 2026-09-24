/**
 * Role-scoping utilities for HOSTEL360.
 * 
 * Provides helper functions to determine which hostels and messes
 * a user is authorized to access based on their role and staff assignments.
 */

/**
 * Returns an array of hostel IDs the user is authorized for.
 * - SUPER_ADMIN → null (meaning ALL hostels — caller should not filter)
 * - WARDEN / VICE_WARDEN / CARETAKER → from staff_hostel_assignments
 * - STUDENT → their own hostel only
 * - Others → empty array
 * @param {object} user - The user object from req.user (with relations loaded)
 * @returns {string[] | null} Array of hostel IDs, or null for unrestricted access
 */
export function getUserHostelIds(user) {
  if (user.role === 'SUPER_ADMIN') {
    return null; // unrestricted
  }

  if (['WARDEN', 'VICE_WARDEN', 'CARETAKER'].includes(user.role)) {
    return (user.staff_hostel_assignments || []).map(a => a.hostel_id);
  }

  if (user.role === 'STUDENT' && user.student) {
    return [user.student.hostel_id];
  }

  return [];
}

/**
 * Returns an array of mess IDs the user is authorized for.
 * - SUPER_ADMIN → null (meaning ALL messes — caller should not filter)
 * - MESS_ADMIN → from staff_mess_assignments
 * - Others → empty array
 * @param {object} user - The user object from req.user (with relations loaded)
 * @returns {string[] | null} Array of mess IDs, or null for unrestricted access
 */
export function getUserMessIds(user) {
  if (user.role === 'SUPER_ADMIN') {
    return null; // unrestricted
  }

  if (user.role === 'MESS_ADMIN') {
    return (user.staff_mess_assignments || []).map(a => a.mess_id);
  }

  return [];
}

/**
 * Checks if a user has access to a specific hostel.
 * @param {object} user - The user object from req.user
 * @param {string} hostelId - The hostel ID to check
 * @returns {boolean}
 */
export function userHasHostelAccess(user, hostelId) {
  const ids = getUserHostelIds(user);
  if (ids === null) return true; // SUPER_ADMIN
  return ids.includes(hostelId);
}

/**
 * Checks if a user has access to a specific mess.
 * @param {object} user - The user object from req.user
 * @param {string} messId - The mess ID to check
 * @returns {boolean}
 */
export function userHasMessAccess(user, messId) {
  const ids = getUserMessIds(user);
  if (ids === null) return true; // SUPER_ADMIN
  return ids.includes(messId);
}

/**
 * Returns the role-specific label for display purposes.
 * @param {string} role - The role enum value
 * @returns {string}
 */
export function getRoleLabel(role) {
  const labels = {
    SUPER_ADMIN: 'Dean of Student Welfare (DSW)',
    WARDEN: 'Warden',
    VICE_WARDEN: 'Vice Warden',
    CARETAKER: 'Caretaker',
    MESS_ADMIN: 'Mess Administrator',
    STUDENT: 'Student',
  };
  return labels[role] || role;
}
