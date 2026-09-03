const db = require("../config/db");
const { writeAuditLog } = require("../middleware/auditMiddleware");

const hasPermission = async (userId, permissionName) => {
    if (!userId || !permissionName) {
        return false;
    }

    const [rows] = await db.query(
        `SELECT p.id
        FROM users u
        INNER JOIN user_roles ur ON ur.user_id = u.id
        INNER JOIN roles r ON r.id = ur.role_id
        INNER JOIN role_permissions rp ON rp.role_id = r.id
        INNER JOIN permissions p ON p.id = rp.permission_id
        WHERE u.id = ?
        AND p.name = ?
        LIMIT 1`,
        [userId, permissionName]
    );

    return rows.length > 0;
};

const getPermissionById = async (permissionId) => {
    const [rows] = await db.query(
        "SELECT id, name, description FROM permissions WHERE id = ?",
        [permissionId]
    );

    return rows[0] || null;
};

const listPermissions = async () => {
    const [permissions] = await db.query(
        "SELECT id, name, description FROM permissions ORDER BY name ASC"
    );

    return permissions;
};

const createPermission = async ({ req, name, description }) => {
    const [result] = await db.query(
        "INSERT INTO permissions (name, description) VALUES (?, ?)",
        [name, description || null]
    );

    await writeAuditLog({
        req,
        action: "PERMISSION_CREATED",
        resourceType: "permission",
        resourceId: result.insertId,
        status: "success",
    });

    return getPermissionById(result.insertId);
};

module.exports = {
    hasPermission,
    getPermissionById,
    listPermissions,
    createPermission,
};
