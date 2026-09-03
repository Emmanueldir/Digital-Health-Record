const db = require("../config/db");
const { writeAuditLog } = require("../middleware/auditMiddleware");

const listUserRoles = async (userId) => {
    const [roles] = await db.query(
        `SELECT r.id, r.name, r.description
        FROM roles r
        INNER JOIN user_roles ur ON ur.role_id = r.id
        WHERE ur.user_id = ?
        ORDER BY r.name ASC`,
        [userId]
    );

    return roles;
};

const assignRoleToUser = async ({ req, userId, roleId }) => {
    await db.query(
        "INSERT IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)",
        [userId, roleId]
    );

    await writeAuditLog({
        req,
        action: "ROLE_ASSIGNED",
        resourceType: "user_role",
        resourceId: userId,
        status: "success",
    });

    return listUserRoles(userId);
};

const removeRoleFromUser = async ({ req, userId, roleId }) => {
    await db.query(
        "DELETE FROM user_roles WHERE user_id = ? AND role_id = ?",
        [userId, roleId]
    );

    await writeAuditLog({
        req,
        action: "ROLE_REMOVED",
        resourceType: "user_role",
        resourceId: userId,
        status: "success",
    });

    return listUserRoles(userId);
};

module.exports = {
    listUserRoles,
    assignRoleToUser,
    removeRoleFromUser,
};
