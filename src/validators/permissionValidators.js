const { body } = require("express-validator");
const db = require("../config/db");

const permissionNameIsUnique = async (name) => {
    const [rows] = await db.query(
        "SELECT id FROM permissions WHERE LOWER(name) = LOWER(?)",
        [name]
    );

    if (rows.length > 0) {
        throw new Error("permission name must be unique");
    }
};

const createPermissionValidator = [
    body("name")
        .trim()
        .matches(/^[a-z][a-z0-9_]{2,99}$/)
        .withMessage("name must be snake_case and at least 3 characters"),
    body("name").custom(permissionNameIsUnique),
    body("description").optional({ nullable: true }).trim().isLength({ max: 500 }).withMessage("description must be 500 characters or less"),
];

module.exports = {
    createPermissionValidator,
};
