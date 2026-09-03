const db = require("../config/db");

const parsePagination = (query) => {
    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
    const offset = (page - 1) * limit;

    return { page, limit, offset };
};

const auditSelect = `SELECT user_id AS user, action, resource_type, resource_id, status, created_at
FROM audit_logs`;

exports.getAuditLogs = async (req, res, next) => {
    try {
        const { page, limit, offset } = parsePagination(req.query);

        const [logs] = await db.query(
            `${auditSelect}
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?`,
            [limit, offset]
        );

        return res.status(200).json({
            success: true,
            message: "Audit logs retrieved successfully",
            data: { page, limit, logs },
        });
    } catch (error) {
        error.message = "Failed to retrieve audit logs";
        return next(error);
    }
};

exports.getPatientAuditLogs = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { page, limit, offset } = parsePagination(req.query);

        const [logs] = await db.query(
            `${auditSelect}
            WHERE (resource_type = ? AND resource_id = ?)
            OR (resource_type = ? AND (resource_id = ? OR resource_id IN (SELECT id FROM medical_records WHERE patient_id = ?)))
            OR (resource_type = ? AND (resource_id = ? OR resource_id IN (SELECT id FROM vitals WHERE patient_id = ?)))
            OR (resource_type = ? AND (resource_id = ? OR resource_id IN (SELECT id FROM lab_results WHERE patient_id = ?)))
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?`,
            [
                "patient",
                id,
                "medical_record",
                id,
                id,
                "vitals",
                id,
                id,
                "lab_result",
                id,
                id,
                limit,
                offset,
            ]
        );

        return res.status(200).json({
            success: true,
            message: "Patient audit logs retrieved successfully",
            data: { page, limit, logs },
        });
    } catch (error) {
        error.message = "Failed to retrieve patient audit logs";
        return next(error);
    }
};

exports.getUserAuditLogs = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { page, limit, offset } = parsePagination(req.query);

        const [logs] = await db.query(
            `${auditSelect}
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?`,
            [id, limit, offset]
        );

        return res.status(200).json({
            success: true,
            message: "User audit logs retrieved successfully",
            data: { page, limit, logs },
        });
    } catch (error) {
        error.message = "Failed to retrieve user audit logs";
        return next(error);
    }
};
