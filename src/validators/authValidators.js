const { body } = require("express-validator");

const registerValidator = [
    body("username").trim().isLength({ min: 3 }).withMessage("username must be at least 3 characters"),
    body("email").trim().isEmail().withMessage("email must be valid").normalizeEmail(),
    body("password").isLength({ min: 8 }).withMessage("password must be at least 8 characters"),
];

const loginValidator = [
    body("email").trim().isEmail().withMessage("email must be valid").normalizeEmail(),
    body("password").notEmpty().withMessage("password is required"),
    body("role").optional().isString().trim().notEmpty().withMessage("role must be a non-empty string"),
];

module.exports = {
    registerValidator,
    loginValidator,
};
