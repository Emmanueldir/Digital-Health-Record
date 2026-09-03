-- seeds roles
INSERT INTO roles(name, description)
VALUES
('Admin','System administrator'),
('Doctor','Medical doctor'),
('Nurse','Hospital nurse'),
('Lab Technician','Laboratory technician'),
('Patient','Patient account');

-- seeds permission
INSERT INTO permissions(name)
VALUES
('create_user'),
('view_users'),
('edit_user'),
('delete_user'),
('assign_roles'),

('create_patient'),
('view_patient'),
('edit_patient'),

('create_medical_record'),
('view_medical_record'),
('edit_medical_record'),

('create_vitals'),
('view_vitals'),
('edit_vitals'),

('create_lab_result'),
('view_lab_result'),

('view_audit_logs'),

('use_break_glass'),
('request_break_glass'),
('approve_break_glass'),
('view_break_glass'),

('generate_qr'),
('upload_attachment'),
('view_attachment'),
('download_attachment'),
('delete_attachment'),

('view_patient_timeline'),

('manage_roles'),
('manage_permissions'),
('manage_users');
