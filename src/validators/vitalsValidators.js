const { body } = require("express-validator");

const optionalNumeric = (field) =>
    body(field).optional({ nullable: true }).isNumeric().withMessage(`${field} must be numeric`);

const createVitalsValidator = [
    body("patient_id").isInt({ min: 1 }).withMessage("patient_id must be a positive integer"),
    optionalNumeric("temperature"),
    optionalNumeric("pulse"),
    optionalNumeric("weight"),
    optionalNumeric("height"),
];

module.exports = { createVitalsValidator };
