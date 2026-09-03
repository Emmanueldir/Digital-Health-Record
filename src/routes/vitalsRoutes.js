const express = require("express");
const router = express.Router();

const authenticateToken = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/rbacMiddleware");
const { authorizePermission } = require("../middleware/permissionMiddleware");
const { requireCareTeamAccess } = require("../middleware/accessMiddleware");
const { validateRequest } = require("../middleware/validationMiddleware");
const { createVitalsValidator } = require("../validators/vitalsValidators");
const vitalsController = require("../controllers/vitalsController");

router.use(authenticateToken);

router.post("/", createVitalsValidator, validateRequest, authorizeRoles("doctor", "nurse", "admin"), authorizePermission("create_vitals"), requireCareTeamAccess("patient_id"), vitalsController.createVitals);
router.get("/patient/:id", authorizeRoles("doctor", "nurse", "admin"), authorizePermission("view_vitals"), requireCareTeamAccess("id"), vitalsController.getVitalsByPatient);

module.exports = router;
