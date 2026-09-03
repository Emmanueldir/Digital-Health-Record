# Digital Health Record System API Documentation

Base URL (local development): `http://localhost:5000`

All examples use fictional data. Do not include real patient, staff, credential, token, or attachment data in requests, documentation, logs, or screenshots.

Protected routes require:

```http
Authorization: Bearer <accessToken>
```

Common validation error:

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [{ "field": "email", "message": "email must be valid" }]
}
```

Common authorization errors:

```json
{ "success": false, "message": "Authorization header is required" }
```

```json
{ "success": false, "message": "Forbidden" }
```

```json
{ "success": false, "message": "Permission denied" }
```

## Authentication

### `POST /api/auth/register`

Description: Create a new user account. The system automatically assigns the `Patient` role.

Access Control: Public

Request Body:

```json
{
  "username": "example_patient",
  "email": "patient@example.test",
  "password": "example-password-only",
  "phone": "+15555550100"
}
```

Response:

```json
{
  "message": "User registered successfully",
  "userId": 1
}
```

Error Responses:

- `400` user already exists.
- `422` invalid username, email, or password.
- `500` registration failure.

### `POST /api/auth/login`

Description: Authenticate a user for the selected role. Patients receive a JWT immediately. Staff roles receive an OTP challenge and must verify the OTP before a JWT is issued.

Access Control: Public

Request Body:

```json
{
  "email": "patient@example.test",
  "password": "example-password-only",
  "role": "Patient"
}
```

Response:

Patient response:

```json
{
  "success": true,
  "message": "Login successful",
  "accessToken": "<jwt>",
  "token": "<jwt>",
  "user": {
    "id": 1,
    "email": "patient@example.test",
    "role": "Patient"
  }
}
```

Staff response:

```json
{
  "success": true,
  "requiresOtp": true,
  "message": "OTP verification required"
}
```

Error Responses:

- `401` invalid email/password or expired token.
- `403` inactive account or unauthorized role.
- `422` invalid request body.

### `POST /api/auth/verify-otp`

Description: Verify a staff OTP and issue a JWT access token.

Access Control: Public. Only staff users with a valid unused OTP can complete this flow.

Request Body:

```json
{
  "email": "clinician@example.test",
  "otp": "123456"
}
```

Response:

```json
{
  "success": true,
  "message": "Login successful",
  "accessToken": "<jwt>",
  "token": "<jwt>",
  "user": {
    "id": 1,
    "email": "clinician@example.test",
    "role": "Doctor"
  }
}
```

Error Responses:

- `401` invalid or expired OTP.
- `403` inactive account or OTP not authorized for the user.
- `422` invalid email or OTP format.

### `POST /api/auth/resend-otp`

Description: Invalidate previous unused OTPs and send a new OTP for a staff role.

Access Control: Public. Requires a valid user and staff role.

Request Body:

```json
{
  "email": "clinician@example.test",
  "role": "Doctor"
}
```

Response:

```json
{
  "success": true,
  "requiresOtp": true,
  "message": "OTP resent successfully"
}
```

Error Responses:

- `400` OTP not required for the selected role.
- `401` invalid user.
- `403` inactive account or unauthorized role.
- `422` invalid request body.

Token validation and refresh: refresh tokens are not implemented. Token validation happens through protected endpoints via `authMiddleware`.

## Patients

### `POST /api/patients`

Description: Create a patient profile. If the authenticated user is a doctor, they are automatically assigned as `PRIMARY_DOCTOR`.

Access Control: Doctor/Admin, `create_patient`

Request Body:

```json
{
  "patient_code": "PAT-001",
  "full_name": "Example Patient",
  "gender": "Female",
  "date_of_birth": "1990-01-20",
  "phone": "+15555550100",
  "address": "Example City"
}
```

Response:

```json
{
  "success": true,
  "message": "Patient created successfully",
  "data": { "id": 1, "patient_code": "PAT-001", "full_name": "Example Patient" }
}
```

Error Responses: `401`, `403`, `422`, `500`.

### `GET /api/patients`

Description: List patients. Admins see all patients; non-admin staff see active care-team patients only.

Access Control: Doctor/Nurse/Admin, `view_patient`

Response:

```json
{
  "success": true,
  "message": "Patients retrieved successfully",
  "data": []
}
```

### `GET /api/patients/:id`

Description: Retrieve a single patient.

Access Control: Doctor/Nurse/Admin, `view_patient`, care-team access or active approved break-glass access unless admin.

Response:

```json
{
  "success": true,
  "message": "Patient retrieved successfully",
  "data": { "id": 1, "full_name": "Example Patient" }
}
```

### `GET /api/patients/:id/qr`

Description: Retrieve or generate a safe QR identifier and QR image for a patient. The QR payload contains only the `PAT-000001`-style identifier.

Access Control: Doctor/Nurse/Admin, `generate_qr`, care-team access or active approved break-glass access unless admin.

Response:

```json
{
  "success": true,
  "message": "Patient QR retrieved successfully",
  "data": {
    "patientId": 1,
    "qrIdentifier": "PAT-000001",
    "qrImage": "data:image/png;base64,..."
  }
}
```

### `GET /api/patients/qr/:identifier`

Description: Look up a patient from a QR identifier. This endpoint returns only minimal identity fields and no medical metadata.

Access Control: Doctor/Nurse/Admin, `view_patient`, care-team access or active approved break-glass access unless admin.

Response:

```json
{
  "success": true,
  "message": "Patient QR lookup successful",
  "data": {
    "patientId": 1,
    "patientCode": "PAT-001",
    "fullName": "Example Patient",
    "qrIdentifier": "PAT-000001"
  }
}
```

### `PUT /api/patients/:id`

Description: Update patient profile fields.

Access Control: Doctor/Admin, `edit_patient`, care-team access or active approved break-glass access unless admin.

Request Body:

```json
{
  "phone": "+15555550101",
  "address": "Example City"
}
```

Response:

```json
{
  "success": true,
  "message": "Patient updated successfully",
  "data": { "id": 1, "phone": "08111111111" }
}
```

### `DELETE /api/patients/:id`

Description: Delete a patient.

Access Control: Admin, `delete_patient`

Response:

```json
{
  "success": true,
  "message": "Patient deleted successfully",
  "data": { "id": 1 }
}
```

## Medical Records

### `POST /api/records`

Description: Create a medical record for a patient.

Access Control: Doctor/Admin, `create_medical_record`, care-team access or active approved break-glass access unless admin.

Request Body:

```json
{
  "patient_id": 1,
  "diagnosis": "Malaria",
  "treatment": "Antimalarial therapy",
  "prescription": "Artemether/Lumefantrine",
  "notes": "Review in 7 days"
}
```

Response:

```json
{
  "success": true,
  "message": "Medical record created successfully",
  "data": { "id": 1, "patient_id": 1, "diagnosis": "Malaria" }
}
```

### `GET /api/records/patient/:id`

Description: Retrieve all medical records for a patient.

Access Control: Doctor/Nurse/Admin, `view_medical_record`, care-team access or active approved break-glass access unless admin.

### `GET /api/records/:id`

Description: Retrieve a single medical record.

Access Control: Doctor/Nurse/Admin, `view_medical_record`, care-team access or active approved break-glass access unless admin.

### `PUT /api/records/:id`

Description: Update diagnosis, treatment, prescription, or notes.

Access Control: Doctor/Admin, `edit_medical_record`, care-team access or active approved break-glass access unless admin.

Request Body:

```json
{
  "diagnosis": "Updated diagnosis",
  "notes": "Updated notes"
}
```

## Care Team

### `POST /api/care-team`

Description: Assign a user to a patient's care team.

Access Control: Admin or patient's active primary doctor, `assign_roles`

Request Body:

```json
{
  "patient_id": 1,
  "user_id": 2,
  "role": "NURSE"
}
```

Response:

```json
{
  "success": true,
  "message": "Care-team member assigned successfully",
  "data": { "id": 1, "patient_id": 1, "user_id": 2, "role": "NURSE" }
}
```

### `PUT /api/care-team/:id/deactivate`

Description: Deactivate a care-team member.

Access Control: Admin or patient's active primary doctor, `assign_roles`

Response:

```json
{
  "success": true,
  "message": "Care-team member deactivated successfully",
  "data": { "id": 1, "is_active": 0 }
}
```

## Vitals

### `POST /api/vitals`

Description: Record patient vital signs.

Access Control: Doctor/Nurse/Admin, `create_vitals`, care-team access or active approved break-glass access unless admin.

Request Body:

```json
{
  "patient_id": 1,
  "blood_pressure": "120/80",
  "temperature": 37.2,
  "pulse": 78,
  "weight": 70,
  "height": 175,
  "notes": "Stable"
}
```

Response:

```json
{
  "success": true,
  "message": "Vitals recorded successfully",
  "data": { "id": 1, "patient_id": 1 }
}
```

### `GET /api/vitals/patient/:id`

Description: Retrieve vitals for a patient.

Access Control: Doctor/Nurse/Admin, `view_vitals`, care-team access or active approved break-glass access unless admin.

## Lab Results

### `POST /api/labs`

Description: Create a lab result.

Access Control: Doctor/Lab Technician/Admin, `create_lab_result`, care-team access or active approved break-glass access unless admin.

Request Body:

```json
{
  "patient_id": 1,
  "test_type": "Full Blood Count",
  "result": "Normal",
  "file_url": "https://example.com/result.pdf"
}
```

Response:

```json
{
  "success": true,
  "message": "Lab result created successfully",
  "data": { "id": 1, "patient_id": 1, "test_type": "Full Blood Count" }
}
```

### `GET /api/labs/patient/:id`

Description: Retrieve lab results for a patient.

Access Control: Doctor/Nurse/Lab Technician/Admin, `view_lab_result`, care-team access or active approved break-glass access unless admin.

## Uploads & Attachments

Allowed file types: `pdf`, `jpg`, `jpeg`, `png`.

Maximum file size: 10 MB.

Attachment responses never expose local filesystem paths.

### `POST /api/uploads`

Description: Upload a patient-related attachment.

Access Control: Doctor/Nurse/Lab Technician/Admin, `upload_attachment`, care-team access or active approved break-glass access unless admin.

Content-Type: `multipart/form-data`

Fields:

- `patient_id`
- `description`
- `file`

Response:

```json
{
  "success": true,
  "message": "Attachment uploaded successfully",
  "data": {
    "id": 1,
    "patient_id": 1,
    "uploaded_by": 2,
    "file_name": "lab-report.pdf",
    "file_type": "application/pdf",
    "file_size": 2048,
    "description": "Initial lab report"
  }
}
```

Error Responses:

- `400` missing file, invalid file type, or file larger than 10 MB.
- `401` missing or invalid token.
- `403` missing role, permission, care-team access, or break-glass access.

### `GET /api/uploads/patient/:id`

Description: Retrieve sanitized attachment metadata for a patient.

Access Control: Doctor/Nurse/Lab Technician/Admin, `view_attachment`, care-team access or active approved break-glass access unless admin.

Response:

```json
{
  "success": true,
  "message": "Attachments retrieved successfully",
  "data": []
}
```

### `GET /api/uploads/:id`

Description: Download an attachment.

Access Control: Doctor/Nurse/Lab Technician/Admin, `download_attachment`, care-team access or active approved break-glass access unless admin.

Response: file download stream.

### `DELETE /api/uploads/:id`

Description: Delete an attachment.

Access Control: Admin or the original uploader, plus `delete_attachment`.

Response:

```json
{
  "success": true,
  "message": "Attachment deleted successfully",
  "data": { "id": 1 }
}
```

## Audit Logs

### `GET /api/audit`

Description: Retrieve all audit logs with pagination.

Access Control: Admin, `view_audit_logs`

Query Parameters:

- `page`: default `1`
- `limit`: default `20`, max `100`

Response:

```json
{
  "success": true,
  "message": "Audit logs retrieved successfully",
  "data": {
    "page": 1,
    "limit": 20,
    "logs": []
  }
}
```

### `GET /api/audit/patient/:id`

Description: Retrieve audit timeline entries related to a patient.

Access Control: Doctor/Nurse/Admin, `view_patient_timeline`, care-team access unless admin.

### `GET /api/audit/user/:id`

Description: Retrieve audit entries for a user.

Access Control: Admin, `view_audit_logs`

## Break Glass Emergency Access

### `POST /api/break-glass/request`

Description: Request temporary emergency access to a patient outside the user's care team.

Access Control: Admin/Doctor/Nurse, `request_break_glass`

Request Body:

```json
{
  "patient_id": 5,
  "reason": "Emergency trauma treatment"
}
```

Response:

```json
{
  "success": true,
  "message": "Break-glass request created successfully",
  "data": { "id": 1 }
}
```

Error Responses: `401`, `403`, `404`, `422`, `500`.

### `POST /api/break-glass/:id/approve`

Description: Approve a pending break-glass request for 4 hours.

Access Control: Admin, `approve_break_glass`

Response:

```json
{
  "success": true,
  "message": "Break-glass request approved successfully",
  "data": { "id": 1 }
}
```

### `POST /api/break-glass/:id/reject`

Description: Reject a pending break-glass request.

Access Control: Admin, `approve_break_glass`

Response:

```json
{
  "success": true,
  "message": "Break-glass request rejected successfully",
  "data": { "id": 1 }
}
```

### `GET /api/break-glass`

Description: Retrieve all break-glass requests with pagination.

Access Control: Admin, `view_break_glass`

Query Parameters:

- `page`: default `1`
- `limit`: default `20`, max `100`

Response:

```json
{
  "success": true,
  "message": "Break-glass requests retrieved successfully",
  "data": {
    "page": 1,
    "limit": 20,
    "requests": []
  }
}
```

### `GET /api/break-glass/my-requests`

Description: Retrieve the authenticated user's break-glass requests.

Access Control: Authenticated user

Response:

```json
{
  "success": true,
  "message": "My break-glass requests retrieved successfully",
  "data": {
    "page": 1,
    "limit": 20,
    "requests": []
  }
}
```

## Dynamic RBAC Administration

All dynamic RBAC administration routes require a bearer token and DB-backed permissions.

New permissions:

- `manage_roles`
- `manage_permissions`
- `manage_users`

These permissions are seeded for the `Admin` role in `database/schema_updates.sql`.

New audit events:

- `ROLE_CREATED`
- `ROLE_UPDATED`
- `ROLE_DELETED`
- `PERMISSION_CREATED`
- `ROLE_PERMISSION_ASSIGNED`
- `ROLE_PERMISSION_REMOVED`
- `ROLE_ASSIGNED`
- `ROLE_REMOVED`

### `GET /api/roles`

Description: List roles.

Access Control: `manage_roles`

### `POST /api/roles`

Description: Create a role.

Access Control: `manage_roles`

Request Body:

```json
{
  "name": "Receptionist",
  "description": "Handles patient registration"
}
```

Validation: `name` is required and unique.

### `PUT /api/roles/:id`

Description: Update a role name and description.

Access Control: `manage_roles`

### `DELETE /api/roles/:id`

Description: Delete a role.

Access Control: `manage_roles`

Protected roles cannot be deleted: `Admin`, `Doctor`, `Nurse`, `Patient`, `Lab Technician`.

### `GET /api/roles/:roleId/permissions`

Description: List permissions currently assigned to a role.

Access Control: `manage_roles`

### `POST /api/roles/:roleId/permissions`

Description: Assign a permission to a role.

Access Control: `manage_roles`

Request Body:

```json
{
  "permissionId": 5
}
```

### `DELETE /api/roles/:roleId/permissions/:permissionId`

Description: Remove a permission from a role.

Access Control: `manage_roles`

### `GET /api/permissions`

Description: List permissions.

Access Control: `manage_permissions`

### `POST /api/permissions`

Description: Create a permission.

Access Control: `manage_permissions`

Request Body:

```json
{
  "name": "view_reports"
}
```

Validation: `name` is required, unique, and snake_case.

### `GET /api/users/:id/roles`

Description: List roles assigned to a user.

Access Control: `manage_users`

### `POST /api/users/:id/roles`

Description: Assign a role to a user.

Access Control: `manage_users`

Request Body:

```json
{
  "roleId": 2
}
```

### `DELETE /api/users/:id/roles/:roleId`

Description: Remove a role from a user.

Access Control: `manage_users`

## Bootstrap Frontend

The Bootstrap 5 frontend is served from `/app` and can also be opened directly from the `frontend/` folder.

Pages:

- `login.html`: password login and role selection.
- `otp.html`: staff OTP verification and JWT storage in `localStorage`.
- `dashboard.html`: role-aware navigation and module cards.
- `patients.html`, `patient-details.html`: patient list, create flow, detail view, and QR display.
- `records.html`, `vitals.html`, `labs.html`, `uploads.html`: clinical module forms and tables.
- `audit.html`: admin audit log table.
- `break-glass.html`: request list plus admin approve/reject actions.
- `roles.html`, `permissions.html`, `user-roles.html`: dynamic RBAC administration screens using the Sprint 6 APIs.

## Email Notifications

The API sends best-effort email notifications for:

- Care-team assignment.
- Break-glass approval.
- Break-glass rejection.
- Lab result creation to the patient's primary doctor.
- Medical record creation to the patient's primary doctor when created by a non-primary care-team member.

Email delivery never blocks the API response. Notification outcomes are audited as `EMAIL_SENT`, `EMAIL_FAILED`, or `EMAIL_SKIPPED` when SMTP is intentionally unconfigured.
