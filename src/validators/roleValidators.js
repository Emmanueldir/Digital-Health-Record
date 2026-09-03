const { body, param } = require("express-validator");
const db = require("../config/db");

const isPositiveId = (value) => Number.isInteger(Number(value)) && Number(value) > 0;

const recordExists = async (table, id, label) => {
    const [rows] = await db.query(`SELECT id FROM ${table} WHERE id = ?`, [id]);

    if (rows.length === 0) {
        throw new Error(`${label} does not exist`);
    }
};

const roleNameIsUnique = async (name, { req }) => {
    const params = [name];
    let sql = "SELECT id FROM roles WHERE LOWER(name) = LOWER(?)";

    if (req.params.id) {
        sql += " AND id <> ?";
        params.push(req.params.id);
    }

    const [rows] = await db.query(sql, params);

    if (rows.length > 0) {
        throw new Error("role name must be unique");
    }
};

const roleIdParamValidator = [
    param("id").custom((value) => isPositiveId(value)).withMessage("role id must be a positive integer"),
    param("id").custom((value) => recordExists("roles", value, "role")),
];

const rolePermissionParamValidator = [
    param("roleId").custom((value) => isPositiveId(value)).withMessage("role id must be a positive integer"),
    param("roleId").custom((value) => recordExists("roles", value, "role")),
    param("permissionId").optional().custom((value) => isPositiveId(value)).withMessage("permission id must be a positive integer"),
    param("permissionId").optional().custom((value) => recordExists("permissions", value, "permission")),
];

const createRoleValidator = [
    body("name").trim().isLength({ min: 2, max: 50 }).withMessage("name must be between 2 and 50 characters"),
    body("name").custom(roleNameIsUnique),
    body("description").optional({ nullable: true }).trim().isLength({ max: 500 }).withMessage("description must be 500 characters or less"),
];

const updateRoleValidator = [
    ...roleIdParamValidator,
    ...createRoleValidator,
];

const assignPermissionValidator = [
    ...rolePermissionParamValidator,
    body("permissionId").custom((value) => isPositiveId(value)).withMessage("permissionId must be a positive integer"),
    body("permissionId").custom((value) => recordExists("permissions", value, "permission")),
];

module.exports = {
    roleIdParamValidator,
    rolePermissionParamValidator,
    createRoleValidator,
    updateRoleValidator,
    assignPermissionValidator,
};
