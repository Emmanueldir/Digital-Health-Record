const db = require("../config/db");

const getUserId = (req) => {
    const userId = req.user && (req.user.sub || req.user.id);
    return userId ? Number(userId) : null;
};

const getIpAddress = (req) =>
    req.ip ||
    (req.headers && req.headers["x-forwarded-for"]) ||
    (req.connection && req.connection.remoteAddress) ||
    null;

const resolveValue = async (value, req) => {
    if (typeof value === "function") {
        return value(req);
    }

    return value;
};

const writeAuditLog = async ({
    req,
    userId,
    action,
    resourceType,
    resourceId = null,
    status,
}) => {
    try {
        await db.query(
            `INSERT INTO audit_logs
            (user_id, action, resource_type, resource_id, status, ip_address)
            VALUES (?, ?, ?, ?, ?, ?)`,
            [
                userId !== undefined ? userId : getUserId(req),
                action,
                resourceType,
                resourceId,
                status,
                req ? getIpAddress(req) : null,
            ]
        );
    } catch (error) {
        console.error("Audit log failed:", error.message);
    }
};

const logAction = ({ action, resourceType, resourceId = null, status = "success" }) => {
    return async (req, res, next) => {
        const resolvedId = resourceId ? await resolveValue(resourceId, req) : null;

        await writeAuditLog({
            req,
            action,
            resourceType,
            resourceId: resolvedId,
            status,
        });

        return next();
    };
};

module.exports = {
    logAction,
    writeAuditLog,
};
