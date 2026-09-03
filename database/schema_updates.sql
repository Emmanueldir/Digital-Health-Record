-- Care-team authorization architecture updates
-- Apply manually to an existing database after reviewing current table state.

CREATE TABLE IF NOT EXISTS patient_care_team (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    user_id INT NOT NULL,
    role VARCHAR(100) NOT NULL,
    assigned_by INT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (patient_id)
        REFERENCES patients(id)
        ON DELETE CASCADE,

    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    FOREIGN KEY (assigned_by)
        REFERENCES users(id)
        ON DELETE SET NULL,

    INDEX idx_patient_care_team_patient_user (patient_id, user_id),
    INDEX idx_patient_care_team_active (patient_id, is_active)
);

-- If these tables already exist with the previous column names, review data migration needs
-- before dropping/recreating them.

CREATE TABLE IF NOT EXISTS vitals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    recorded_by INT NOT NULL,
    blood_pressure VARCHAR(20),
    temperature DECIMAL(5,2),
    pulse INT,
    weight DECIMAL(6,2),
    height DECIMAL(6,2),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (patient_id)
        REFERENCES patients(id)
        ON DELETE CASCADE,

    FOREIGN KEY (recorded_by)
        REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS lab_results (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    test_type VARCHAR(255) NOT NULL,
    result TEXT NOT NULL,
    file_url VARCHAR(255),
    requested_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (patient_id)
        REFERENCES patients(id)
        ON DELETE CASCADE,

    FOREIGN KEY (requested_by)
        REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    action VARCHAR(255) NOT NULL,
    resource_type VARCHAR(100),
    resource_id INT,
    status ENUM('success','denied') NOT NULL,
    ip_address VARCHAR(50),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE SET NULL
);

-- Baseline role-permission assignments for DB-backed permission middleware.
-- Uses INSERT IGNORE to avoid duplicate key errors when re-applied.

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE LOWER(r.name) = 'admin';

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON p.name IN (
    'create_patient',
    'view_patient',
    'edit_patient',
    'create_medical_record',
    'view_medical_record',
    'edit_medical_record',
    'create_vitals',
    'view_vitals',
    'create_lab_result',
    'view_lab_result',
    'view_patient_timeline'
)
WHERE LOWER(r.name) = 'doctor';

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON p.name IN (
    'assign_roles'
)
WHERE LOWER(r.name) = 'doctor';

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON p.name IN (
    'view_patient',
    'view_medical_record',
    'create_vitals',
    'view_vitals',
    'view_lab_result',
    'view_patient_timeline'
)
WHERE LOWER(r.name) = 'nurse';

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON p.name IN (
    'create_lab_result',
    'view_lab_result'
)
WHERE LOWER(r.name) = 'lab technician';

-- Sprint 6: Dynamic RBAC administration permissions.

INSERT IGNORE INTO permissions (name)
VALUES
('manage_roles'),
('manage_permissions'),
('manage_users');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON p.name IN (
    'manage_roles',
    'manage_permissions',
    'manage_users'
)
WHERE LOWER(r.name) = 'admin';

-- Sprint 4: Break-glass emergency access and staff OTP.

SET @column_exists = (
    SELECT COUNT(1)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
    AND table_name = 'otp_verifications'
    AND column_name = 'role'
);
SET @sql = IF(
    @column_exists = 0,
    'ALTER TABLE otp_verifications ADD COLUMN role VARCHAR(50) NULL AFTER otp_code',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
    SELECT COUNT(1)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
    AND table_name = 'break_glass_requests'
    AND column_name = 'requested_by'
);
SET @sql = IF(
    @column_exists = 0,
    'ALTER TABLE break_glass_requests ADD COLUMN requested_by INT NULL AFTER patient_id',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
    SELECT COUNT(1)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
    AND table_name = 'break_glass_requests'
    AND column_name = 'status'
);
SET @sql = IF(
    @column_exists = 0,
    'ALTER TABLE break_glass_requests ADD COLUMN status ENUM(''PENDING'',''APPROVED'',''REJECTED'',''EXPIRED'') NOT NULL DEFAULT ''PENDING'' AFTER reason',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
    SELECT COUNT(1)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
    AND table_name = 'break_glass_requests'
    AND column_name = 'approved_by'
);
SET @sql = IF(
    @column_exists = 0,
    'ALTER TABLE break_glass_requests ADD COLUMN approved_by INT NULL AFTER status',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
    SELECT COUNT(1)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
    AND table_name = 'break_glass_requests'
    AND column_name = 'approved_at'
);
SET @sql = IF(
    @column_exists = 0,
    'ALTER TABLE break_glass_requests ADD COLUMN approved_at DATETIME NULL AFTER approved_by',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
    SELECT COUNT(1)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
    AND table_name = 'break_glass_requests'
    AND column_name = 'updated_at'
);
SET @sql = IF(
    @column_exists = 0,
    'ALTER TABLE break_glass_requests ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
    SELECT COUNT(1)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
    AND table_name = 'break_glass_requests'
    AND column_name = 'user_id'
);
SET @sql = IF(
    @column_exists = 1,
    'UPDATE break_glass_requests SET requested_by = user_id WHERE requested_by IS NULL AND user_id IS NOT NULL',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE break_glass_requests
    MODIFY requested_by INT NOT NULL;

SET @fk_exists = (
    SELECT COUNT(1)
    FROM information_schema.referential_constraints
    WHERE constraint_schema = DATABASE()
    AND table_name = 'break_glass_requests'
    AND constraint_name = 'fk_break_glass_requested_by'
);
SET @sql = IF(
    @fk_exists = 0,
    'ALTER TABLE break_glass_requests ADD CONSTRAINT fk_break_glass_requested_by FOREIGN KEY (requested_by) REFERENCES users(id)',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk_exists = (
    SELECT COUNT(1)
    FROM information_schema.referential_constraints
    WHERE constraint_schema = DATABASE()
    AND table_name = 'break_glass_requests'
    AND constraint_name = 'fk_break_glass_approved_by'
);
SET @sql = IF(
    @fk_exists = 0,
    'ALTER TABLE break_glass_requests ADD CONSTRAINT fk_break_glass_approved_by FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exists = (
    SELECT COUNT(1)
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
    AND table_name = 'break_glass_requests'
    AND index_name = 'idx_break_glass_patient_user_status'
);
SET @sql = IF(
    @idx_exists = 0,
    'CREATE INDEX idx_break_glass_patient_user_status ON break_glass_requests (patient_id, requested_by, status)',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exists = (
    SELECT COUNT(1)
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
    AND table_name = 'break_glass_requests'
    AND index_name = 'idx_break_glass_expires_at'
);
SET @sql = IF(
    @idx_exists = 0,
    'CREATE INDEX idx_break_glass_expires_at ON break_glass_requests (expires_at)',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

INSERT IGNORE INTO permissions (name)
VALUES
('request_break_glass'),
('approve_break_glass'),
('view_break_glass');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON p.name IN (
    'request_break_glass',
    'approve_break_glass',
    'view_break_glass'
)
WHERE LOWER(r.name) = 'admin';

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON p.name IN ('request_break_glass')
WHERE LOWER(r.name) IN ('doctor', 'nurse');

-- Sprint 5: Attachments, email notification audit events, and QR patient lookup.

SET @column_exists = (
    SELECT COUNT(1)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
    AND table_name = 'patients'
    AND column_name = 'qr_identifier'
);
SET @sql = IF(
    @column_exists = 0,
    'ALTER TABLE patients ADD COLUMN qr_identifier VARCHAR(50) NULL AFTER qr_token',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
    SELECT COUNT(1)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
    AND table_name = 'patients'
    AND column_name = 'qr_image_url'
);
SET @sql = IF(
    @column_exists = 0,
    'ALTER TABLE patients ADD COLUMN qr_image_url TEXT NULL AFTER qr_identifier',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exists = (
    SELECT COUNT(1)
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
    AND table_name = 'patients'
    AND index_name = 'idx_patients_qr_identifier'
);
SET @sql = IF(
    @idx_exists = 0,
    'CREATE UNIQUE INDEX idx_patients_qr_identifier ON patients (qr_identifier)',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS attachments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    uploaded_by INT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(100) NOT NULL,
    file_size INT NOT NULL,
    file_url VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_attachments_patient
        FOREIGN KEY (patient_id)
        REFERENCES patients(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_attachments_uploaded_by
        FOREIGN KEY (uploaded_by)
        REFERENCES users(id)
);

SET @idx_exists = (
    SELECT COUNT(1)
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
    AND table_name = 'attachments'
    AND index_name = 'idx_attachments_patient'
);
SET @sql = IF(
    @idx_exists = 0,
    'CREATE INDEX idx_attachments_patient ON attachments (patient_id)',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exists = (
    SELECT COUNT(1)
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
    AND table_name = 'attachments'
    AND index_name = 'idx_attachments_uploaded_by'
);
SET @sql = IF(
    @idx_exists = 0,
    'CREATE INDEX idx_attachments_uploaded_by ON attachments (uploaded_by)',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

INSERT IGNORE INTO permissions (name)
VALUES
('upload_attachment'),
('view_attachment'),
('download_attachment'),
('delete_attachment');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON p.name IN (
    'upload_attachment',
    'view_attachment',
    'download_attachment',
    'delete_attachment',
    'generate_qr'
)
WHERE LOWER(r.name) = 'admin';

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON p.name IN (
    'upload_attachment',
    'view_attachment',
    'download_attachment',
    'delete_attachment',
    'generate_qr'
)
WHERE LOWER(r.name) IN ('doctor', 'nurse');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON p.name IN (
    'upload_attachment',
    'view_attachment',
    'download_attachment',
    'delete_attachment'
)
WHERE LOWER(r.name) = 'lab technician';
