const { body } = require("express-validator");

const verifyOtpValidator = [
    body("email").trim().isEmail().withMessage("email must be valid").normalizeEmail(),
    body("otp").isLength({ min: 6, max: 6 }).isNumeric().withMessage("otp must be a 6-digit code"),
];

const resendOtpValidator = [
    body("email").trim().isEmail().withMessage("email must be valid").normalizeEmail(),
    body("role").optional().isString().trim().notEmpty().withMessage("role must be a non-empty string"),
];

module.exports = {
    verifyOtpValidator,
    resendOtpValidator,
};
