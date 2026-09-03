const { body, param } = require("express-validator");

const assignCareTeamMemberValidator = [
    body("patient_id").isInt({ min: 1 }).withMessage("patient_id must be a positive integer"),
    body("user_id").isInt({ min: 1 }).withMessage("user_id must be a positive integer"),
    body("role").trim().notEmpty().withMessage("role is required"),
];

const patientCareTeamValidator = [
    param("id").isInt({ min: 1 }).withMessage("patient id must be a positive integer"),
];

const deactivateCareTeamMemberValidator = [
    param("id").isInt({ min: 1 }).withMessage("care-team member id must be a positive integer"),
];

module.exports = {
    assignCareTeamMemberValidator,
    patientCareTeamValidator,
    deactivateCareTeamMemberValidator,
};
