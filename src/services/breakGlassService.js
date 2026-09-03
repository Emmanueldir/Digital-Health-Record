const db = require("../config/db");
const {
    getAuthenticatedUserId,
    isPositiveInteger,
} = require("./accessService");
const { writeAuditLog } = require("../middleware/auditMiddleware");
const { notifyBreakGlassDecision } = require("./notificationService");

const DEFAULT_BREAK_GLASS_HOURS = 4;

const createRequest = async ({ req, patientId, reason }) => {
    const requestedBy = getAuthenticatedUserId(req.user);

    const [patients] = await db.query("SELECT id FROM patients WHERE id = ?", [patientId]);

    if (patients.length === 0) {
        const error = new Error("Patient not found");
        error.statusCode = 404;
        throw error;
    }

    const [result] = await db.query(
        `INSERT INTO break_glass_requests
        (patient_id, requested_by, reason, status, expires_at)
        VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? HOUR))`,
        [patientId, requestedBy, reason, "PENDING", DEFAULT_BREAK_GLASS_HOURS]
    );

    await writeAuditLog({
        req,
        action: "BREAK_GLASS_REQUESTED",
        resourceType: "break_glass",
        resourceId: result.insertId,
        status: "success",
    });

    return result.insertId;
};

const approveRequest = async ({ req, requestId }) => {
    const approverId = getAuthenticatedUserId(req.user);

    const [result] = await db.query(
        `UPDATE break_glass_requests
        SET status = ?, approved_by = ?, approved_at = NOW(),
            expires_at = DATE_ADD(NOW(), INTERVAL ? HOUR), updated_at = NOW()
        WHERE id = ?
        AND status = ?`,
        ["APPROVED", approverId, DEFAULT_BREAK_GLASS_HOURS, requestId, "PENDING"]
    );

    if (result.affectedRows === 0) {
        const error = new Error("Pending break-glass request not found");
        error.statusCode = 404;
        throw error;
    }

    await writeAuditLog({
        req,
        action: "BREAK_GLASS_APPROVED",
        resourceType: "break_glass",
        resourceId: requestId,
        status: "success",
    });

    await notifyBreakGlassDecision({
        req,
        requestId,
        approved: true,
    });
};

const rejectRequest = async ({ req, requestId }) => {
    const approverId = getAuthenticatedUserId(req.user);

    const [result] = await db.query(
        `UPDATE break_glass_requests
        SET status = ?, approved_by = ?, approved_at = NOW(), updated_at = NOW()
        WHERE id = ?
        AND status = ?`,
        ["REJECTED", approverId, requestId, "PENDING"]
    );

    if (result.affectedRows === 0) {
        const error = new Error("Pending break-glass request not found");
        error.statusCode = 404;
        throw error;
    }

    await writeAuditLog({
        req,
        action: "BREAK_GLASS_REJECTED",
        resourceType: "break_glass",
        resourceId: requestId,
        status: "success",
    });

    await notifyBreakGlassDecision({
        req,
        requestId,
        approved: false,
    });
};

const expireRequest = async ({ req, requestId }) => {
    await db.query(
        `UPDATE break_glass_requests
        SET status = ?, updated_at = NOW()
        WHERE id = ?
        AND status = ?`,
        ["EXPIRED", requestId, "APPROVED"]
    );

    await writeAuditLog({
        req,
        action: "BREAK_GLASS_EXPIRED",
        resourceType: "break_glass",
        resourceId: requestId,
        status: "denied",
    });
};

const findActiveApprovedAccess = async ({ userId, patientId }) => {
    if (!isPositiveInteger(userId) || !isPositiveInteger(patientId)) {
        return null;
    }

    const [rows] = await db.query(
        `SELECT id, expires_at
        FROM break_glass_requests
        WHERE requested_by = ?
        AND patient_id = ?
        AND status = ?
        ORDER BY approved_at DESC
        LIMIT 1`,
        [userId, patientId, "APPROVED"]
    );

    if (rows.length === 0) {
        return null;
    }

    const access = rows[0];

    if (new Date(access.expires_at).getTime() <= Date.now()) {
        return { ...access, isExpired: true };
    }

    return { ...access, isExpired: false };
};

const listRequests = async ({ limit, offset }) => {
    const [rows] = await db.query(
        `SELECT id, patient_id, requested_by, reason, status, approved_by,
        approved_at, expires_at, created_at, updated_at
        FROM break_glass_requests
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?`,
        [limit, offset]
    );

    return rows;
};

const listUserRequests = async ({ userId, limit, offset }) => {
    const [rows] = await db.query(
        `SELECT id, patient_id, requested_by, reason, status, approved_by,
        approved_at, expires_at, created_at, updated_at
        FROM break_glass_requests
        WHERE requested_by = ?
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?`,
        [userId, limit, offset]
    );

    return rows;
};

module.exports = {
    createRequest,
    approveRequest,
    rejectRequest,
    expireRequest,
    findActiveApprovedAccess,
    listRequests,
    listUserRequests,
};
