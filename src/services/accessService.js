const db = require("../config/db");
const { writeAuditLog } = require("../middleware/auditMiddleware");

const normalizeRole = (role) => {
    const normalized = String(role || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
    return normalized === "lab_technician" ? "lab_tech" : normalized;
};

const getAuthenticatedUserId = (user) => {
    const userId = user && (user.sub || user.id);
    return userId ? Number(userId) : null;
};

const isAdmin = (user) => normalizeRole(user && user.role) === "admin";

const isPositiveInteger = (value) => Number.isInteger(Number(value)) && Number(value) > 0;

const isUserInCareTeam = async (userId, patientId) => {
    if (!isPositiveInteger(userId) || !isPositiveInteger(patientId)) {
        return false;
    }

    const [rows] = await db.query(
        `SELECT id
        FROM patient_care_team
        WHERE user_id = ?
        AND patient_id = ?
        AND is_active = TRUE
        LIMIT 1`,
        [userId, patientId]
    );

    return rows.length > 0;
};

const hasActiveBreakGlassAccess = async ({ req, userId, patientId }) => {
    const { findActiveApprovedAccess, expireRequest } = require("./breakGlassService");
    const access = await findActiveApprovedAccess({ userId, patientId });

    if (!access) {
        return false;
    }

    if (access.isExpired) {
        await expireRequest({ req, requestId: access.id });
        return false;
    }

    await writeAuditLog({
        req,
        action: "BREAK_GLASS_USED",
        resourceType: "break_glass",
        resourceId: access.id,
        status: "success",
    });

    return true;
};

const hasPatientAccess = async ({ req, user, patientId }) => {
    if (isAdmin(user)) {
        return true;
    }

    const userId = getAuthenticatedUserId(user);
    const isCareTeamMember = await isUserInCareTeam(userId, patientId);

    if (isCareTeamMember) {
        return true;
    }

    return hasActiveBreakGlassAccess({ req, userId, patientId });
};

const isPrimaryAssignedDoctor = async (userId, patientId) => {
    if (!isPositiveInteger(userId) || !isPositiveInteger(patientId)) {
        return false;
    }

    const [rows] = await db.query(
        `SELECT pct.id
        FROM patient_care_team pct
        INNER JOIN users u ON u.id = pct.user_id
        INNER JOIN user_roles ur ON ur.user_id = u.id
        INNER JOIN roles r ON r.id = ur.role_id
        WHERE pct.user_id = ?
        AND pct.patient_id = ?
        AND pct.is_active = TRUE
        AND LOWER(r.name) = 'doctor'
        AND LOWER(pct.role) IN ('primary_doctor', 'primary doctor')
        LIMIT 1`,
        [userId, patientId]
    );

    return rows.length > 0;
};

const canManageCareTeam = async (user, patientId) => {
    if (isAdmin(user)) {
        return true;
    }

    return isPrimaryAssignedDoctor(getAuthenticatedUserId(user), patientId);
};

const getMedicalRecordPatientId = async (recordId) => {
    if (!isPositiveInteger(recordId)) {
        return null;
    }

    const [rows] = await db.query(
        "SELECT patient_id FROM medical_records WHERE id = ?",
        [recordId]
    );

    return rows.length > 0 ? rows[0].patient_id : null;
};

module.exports = {
    normalizeRole,
    getAuthenticatedUserId,
    isAdmin,
    isPositiveInteger,
    isUserInCareTeam,
    hasActiveBreakGlassAccess,
    hasPatientAccess,
    isPrimaryAssignedDoctor,
    canManageCareTeam,
    getMedicalRecordPatientId,
};
