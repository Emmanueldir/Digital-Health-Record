-- create database
CREATE DATABASE digital_health_records;
USE digital_health_records;

-- create RBAC tables
-- roles
CREATE TABLE roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- permissions
CREATE TABLE permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- users
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    status ENUM('active','inactive','suspended') DEFAULT 'active',
    last_login DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- user roles
CREATE TABLE user_roles (
    user_id INT NOT NULL,
    role_id INT NOT NULL,

    PRIMARY KEY (user_id, role_id),

    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    FOREIGN KEY (role_id)
        REFERENCES roles(id)
        ON DELETE CASCADE
);

-- roles permissons
CREATE TABLE role_permissions (
    role_id INT NOT NULL,
    permission_id INT NOT NULL,

    PRIMARY KEY (role_id, permission_id),

    FOREIGN KEY (role_id)
        REFERENCES roles(id)
        ON DELETE CASCADE,

    FOREIGN KEY (permission_id)
        REFERENCES permissions(id)
        ON DELETE CASCADE
);

-- create patients table
CREATE TABLE patients (
    id INT AUTO_INCREMENT PRIMARY KEY,

    patient_code VARCHAR(50) UNIQUE NOT NULL,

    user_id INT NULL,

    full_name VARCHAR(150) NOT NULL,

    gender ENUM('Male','Female'),

    date_of_birth DATE,

    address TEXT,

    phone VARCHAR(20),

    emergency_contact VARCHAR(20),

    qr_token VARCHAR(255) UNIQUE,

    qr_identifier VARCHAR(50) UNIQUE,

    qr_image_url TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE SET NULL
);

-- patient care team
CREATE TABLE patient_care_team (
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

-- patient attachments
CREATE TABLE attachments (
    id INT AUTO_INCREMENT PRIMARY KEY,

    patient_id INT NOT NULL,

    uploaded_by INT NOT NULL,

    file_name VARCHAR(255) NOT NULL,

    file_type VARCHAR(100) NOT NULL,

    file_size INT NOT NULL,

    file_url VARCHAR(255) NOT NULL,

    description TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (patient_id)
        REFERENCES patients(id)
        ON DELETE CASCADE,

    FOREIGN KEY (uploaded_by)
        REFERENCES users(id),

    INDEX idx_attachments_patient (patient_id),
    INDEX idx_attachments_uploaded_by (uploaded_by)
);


-- medical records
CREATE TABLE medical_records (
    id INT AUTO_INCREMENT PRIMARY KEY,

    patient_id INT NOT NULL,

    doctor_id INT NOT NULL,

    diagnosis TEXT NOT NULL,

    treatment TEXT,

    prescription TEXT,

    notes TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (patient_id)
        REFERENCES patients(id)
        ON DELETE CASCADE,

    FOREIGN KEY (doctor_id)
        REFERENCES users(id)
);


-- vitals
CREATE TABLE vitals (
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


-- lab results
CREATE TABLE lab_results (
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

-- MFA
CREATE TABLE otp_verifications (
    id INT AUTO_INCREMENT PRIMARY KEY,

    user_id INT NOT NULL,

    otp_code VARCHAR(10) NOT NULL,

    role VARCHAR(50) NULL,

    expires_at DATETIME NOT NULL,

    is_used BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);


-- audit logs
CREATE TABLE audit_logs (
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


-- break glass access
CREATE TABLE break_glass_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,

    patient_id INT NOT NULL,

    requested_by INT NOT NULL,

    reason TEXT NOT NULL,

    status ENUM('PENDING','APPROVED','REJECTED','EXPIRED') NOT NULL DEFAULT 'PENDING',

    approved_by INT NULL,

    approved_at DATETIME NULL,

    expires_at DATETIME NOT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (requested_by)
        REFERENCES users(id),

    FOREIGN KEY (approved_by)
        REFERENCES users(id)
        ON DELETE SET NULL,

    FOREIGN KEY (patient_id)
        REFERENCES patients(id)
);


