-- Drop old composite that's redundant now (the new one includes block)
SET FOREIGN_KEY_CHECKS = 0;
ALTER TABLE rooms DROP INDEX rooms_hostel_id_room_number_key;
SET FOREIGN_KEY_CHECKS = 1;

-- Add reason column to audit_logs if not already present
ALTER TABLE audit_logs ADD COLUMN reason TEXT NULL AFTER target_id;

-- Create staff_hostel_assignments table
CREATE TABLE IF NOT EXISTS staff_hostel_assignments (
  id VARCHAR(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  user_id VARCHAR(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  hostel_id VARCHAR(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  role ENUM('STUDENT', 'WARDEN', 'VICE_WARDEN', 'CARETAKER', 'MESS_ADMIN', 'SUPER_ADMIN') COLLATE utf8mb4_unicode_ci NOT NULL,
  is_primary TINYINT(1) NOT NULL DEFAULT 0,
  assigned_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE INDEX staff_hostel_assignments_user_id_hostel_id_key (user_id, hostel_id),
  INDEX staff_hostel_assignments_hostel_id_idx (hostel_id),
  CONSTRAINT staff_hostel_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT staff_hostel_assignments_hostel_id_fkey FOREIGN KEY (hostel_id) REFERENCES hostels(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create staff_mess_assignments table
CREATE TABLE IF NOT EXISTS staff_mess_assignments (
  id VARCHAR(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  user_id VARCHAR(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  mess_id VARCHAR(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  role ENUM('STUDENT', 'WARDEN', 'VICE_WARDEN', 'CARETAKER', 'MESS_ADMIN', 'SUPER_ADMIN') COLLATE utf8mb4_unicode_ci NOT NULL,
  assigned_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE INDEX staff_mess_assignments_user_id_mess_id_key (user_id, mess_id),
  INDEX staff_mess_assignments_mess_id_idx (mess_id),
  CONSTRAINT staff_mess_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT staff_mess_assignments_mess_id_fkey FOREIGN KEY (mess_id) REFERENCES messes(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
