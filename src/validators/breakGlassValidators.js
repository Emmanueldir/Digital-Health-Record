const { body } = require("express-validator");

const createBreakGlassRequestValidator = [
    body("patient_id").isInt({ min: 1 }).withMessage("patient_id must be a positive integer"),
    body("reason").trim().isLength({ min: 5 }).withMessage("reason must be at least 5 characters"),
];

module.exports = { createBreakGlassRequestValidator };
