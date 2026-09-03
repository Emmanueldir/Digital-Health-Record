const { body, param } = require("express-validator");
const db = require("../config/db");

const isPositiveId = (value) => Number.isInteger(Number(value)) && Number(value) > 0;

const recordExists = async (table, id, label) => {
    const [rows] = await db.query(`SELECT id FROM ${table} WHERE id = ?`, [id]);

    if (rows.length === 0) {
        throw new Error(`${label} does not exist`);
    }
};

const userIdParamValidator = [
    param("id").custom((value) => isPositiveId(value)).withMessage("user id must be a positive integer"),
    param("id").custom((value) => recordExists("users", value, "user")),
];

const assignUserRoleValidator = [
    ...userIdParamValidator,
    body("roleId").custom((value) => isPositiveId(value)).withMessage("roleId must be a positive integer"),
    body("roleId").custom((value) => recordExists("roles", value, "role")),
];

const removeUserRoleValidator = [
    ...userIdParamValidator,
    param("roleId").custom((value) => isPositiveId(value)).withMessage("role id must be a positive integer"),
    param("roleId").custom((value) => recordExists("roles", value, "role")),
];

module.exports = {
    userIdParamValidator,
    assignUserRoleValidator,
    removeUserRoleValidator,
};
