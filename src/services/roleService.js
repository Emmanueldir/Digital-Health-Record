const db = require("../config/db");
const { writeAuditLog } = require("../middleware/auditMiddleware");

const PROTECTED_ROLE_NAMES = ["Admin", "Doctor", "Nurse", "Patient", "Lab Technician"];

const buildRoleError = (message, statusCode = 400) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
};

const getRoleById = async (roleId) => {
    const [rows] = await db.query(
        "SELECT id, name, description FROM roles WHERE id = ?",
        [roleId]
    );

    return rows[0] || null;
};

const listRoles = async () => {
    const [roles] = await db.query(
        "SELECT id, name, description FROM roles ORDER BY name ASC"
    );

    return roles;
};

const createRole = async ({ req, name, description }) => {
    const [result] = await db.query(
        "INSERT INTO roles (name, description) VALUES (?, ?)",
        [name, description || null]
    );

    await writeAuditLog({
        req,
        action: "ROLE_CREATED",
        resourceType: "role",
        resourceId: result.insertId,
        status: "success",
    });

    return getRoleById(result.insertId);
};

const updateRole = async ({ req, roleId, name, description }) => {
    const [result] = await db.query(
        "UPDATE roles SET name = ?, description = ? WHERE id = ?",
        [name, description || null, roleId]
    );

    if (result.affectedRows === 0) {
        throw buildRoleError("Role not found", 404);
    }

    await writeAuditLog({
        req,
        action: "ROLE_UPDATED",
        resourceType: "role",
        resourceId: roleId,
        status: "success",
    });

    return getRoleById(roleId);
};

const deleteRole = async ({ req, roleId }) => {
    const role = await getRoleById(roleId);

    if (!role) {
        throw buildRoleError("Role not found", 404);
    }

    if (PROTECTED_ROLE_NAMES.some((name) => name.toLowerCase() === role.name.toLowerCase())) {
        throw buildRoleError("Protected roles cannot be deleted", 400);
    }

    await db.query("DELETE FROM roles WHERE id = ?", [roleId]);

    await writeAuditLog({
        req,
        action: "ROLE_DELETED",
        resourceType: "role",
        resourceId: roleId,
        status: "success",
    });

    return role;
};

const listRolePermissions = async (roleId) => {
    const [permissions] = await db.query(
        `SELECT p.id, p.name, p.description
        FROM permissions p
        INNER JOIN role_permissions rp ON rp.permission_id = p.id
        WHERE rp.role_id = ?
        ORDER BY p.name ASC`,
        [roleId]
    );

    return permissions;
};

const assignPermissionToRole = async ({ req, roleId, permissionId }) => {
    await db.query(
        "INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)",
        [roleId, permissionId]
    );

    await writeAuditLog({
        req,
        action: "ROLE_PERMISSION_ASSIGNED",
        resourceType: "role_permission",
        resourceId: roleId,
        status: "success",
    });

    return listRolePermissions(roleId);
};

const removePermissionFromRole = async ({ req, roleId, permissionId }) => {
    await db.query(
        "DELETE FROM role_permissions WHERE role_id = ? AND permission_id = ?",
        [roleId, permissionId]
    );

    await writeAuditLog({
        req,
        action: "ROLE_PERMISSION_REMOVED",
        resourceType: "role_permission",
        resourceId: roleId,
        status: "success",
    });

    return listRolePermissions(roleId);
};

module.exports = {
    PROTECTED_ROLE_NAMES,
    getRoleById,
    listRoles,
    createRole,
    updateRole,
    deleteRole,
    listRolePermissions,
    assignPermissionToRole,
    removePermissionFromRole,
};
