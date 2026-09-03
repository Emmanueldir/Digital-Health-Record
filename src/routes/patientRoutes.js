const express = require("express");
const router = express.Router();

const authenticateToken = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/rbacMiddleware");
const { authorizePermission } = require("../middleware/permissionMiddleware");
const { requireCareTeamAccess } = require("../middleware/accessMiddleware");
const { validateRequest } = require("../middleware/validationMiddleware");
const { createPatientValidator } = require("../validators/patientValidators");
const { getPatientIdByQrIdentifier } = require("../services/qrService");
const patientController = require("../controllers/patientController");

router.use(authenticateToken);

router.post("/", createPatientValidator, validateRequest, authorizeRoles("doctor", "admin"), authorizePermission("create_patient"), patientController.createPatient);
router.get("/", authorizeRoles("doctor", "nurse", "admin"), authorizePermission("view_patient"), patientController.getPatients);
router.get("/:id/qr", authorizeRoles("doctor", "nurse", "admin"), authorizePermission("generate_qr"), requireCareTeamAccess("id"), patientController.getPatientQr);
router.get("/qr/:identifier", authorizeRoles("doctor", "nurse", "admin"), authorizePermission("view_patient"), requireCareTeamAccess((req) => getPatientIdByQrIdentifier(req.params.identifier)), patientController.lookupPatientByQr);
router.get("/:id", authorizeRoles("doctor", "nurse", "admin"), authorizePermission("view_patient"), requireCareTeamAccess("id"), patientController.getPatientById);
router.put("/:id", authorizeRoles("doctor", "admin"), authorizePermission("edit_patient"), requireCareTeamAccess("id"), patientController.updatePatient);
router.delete("/:id", authorizeRoles("admin"), authorizePermission("delete_patient"), patientController.deletePatient);

module.exports = router;
