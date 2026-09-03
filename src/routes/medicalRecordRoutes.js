const express = require("express");
const router = express.Router();

const authenticateToken = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/rbacMiddleware");
const { authorizePermission } = require("../middleware/permissionMiddleware");
const { requireCareTeamAccess } = require("../middleware/accessMiddleware");
const { validateRequest } = require("../middleware/validationMiddleware");
const { medicalRecordValidator } = require("../validators/medicalRecordValidators");
const { getMedicalRecordPatientId } = require("../services/accessService");
const medicalRecordController = require("../controllers/medicalRecordController");

router.use(authenticateToken);

router.post("/", medicalRecordValidator, validateRequest, authorizeRoles("doctor", "admin"), authorizePermission("create_medical_record"), requireCareTeamAccess("patient_id"), medicalRecordController.createMedicalRecord);
router.get("/patient/:id", authorizeRoles("doctor", "nurse", "admin"), authorizePermission("view_medical_record"), requireCareTeamAccess("id"), medicalRecordController.getRecordsByPatient);
router.get("/:id", authorizeRoles("doctor", "nurse", "admin"), authorizePermission("view_medical_record"), requireCareTeamAccess((req) => getMedicalRecordPatientId(req.params.id)), medicalRecordController.getMedicalRecordById);
router.put("/:id", authorizeRoles("doctor", "admin"), authorizePermission("edit_medical_record"), requireCareTeamAccess((req) => getMedicalRecordPatientId(req.params.id)), medicalRecordController.updateMedicalRecord);

module.exports = router;
