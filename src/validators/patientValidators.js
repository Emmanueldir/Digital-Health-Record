const { body } = require("express-validator");

const createPatientValidator = [
    body("full_name").trim().notEmpty().withMessage("full_name is required"),
    body("gender").optional().isIn(["Male", "Female"]).withMessage("gender must be Male or Female"),
    body("date_of_birth").optional().isISO8601().withMessage("date_of_birth must be a valid date"),
];

module.exports = { createPatientValidator };
