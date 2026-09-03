const { body } = require("express-validator");

const medicalRecordValidator = [
    body("patient_id").isInt({ min: 1 }).withMessage("patient_id must be a positive integer"),
    body("diagnosis").trim().notEmpty().withMessage("diagnosis is required"),
];

module.exports = { medicalRecordValidator };
