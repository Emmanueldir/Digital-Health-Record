const { body } = require("express-validator");

const createLabResultValidator = [
    body("patient_id").isInt({ min: 1 }).withMessage("patient_id must be a positive integer"),
    body("test_type").trim().notEmpty().withMessage("test_type is required"),
];

module.exports = { createLabResultValidator };
