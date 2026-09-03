const express = require("express");
const router = express.Router();

const authenticateToken = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/rbacMiddleware");
const { authorizePermission } = require("../middleware/permissionMiddleware");
const { requireCareTeamAccess } = require("../middleware/accessMiddleware");
const { validateRequest } = require("../middleware/validationMiddleware");
const { createLabResultValidator } = require("../validators/labValidators");
const labController = require("../controllers/labController");

router.use(authenticateToken);

router.post("/", createLabResultValidator, validateRequest, authorizeRoles("doctor", "lab_tech", "admin"), authorizePermission("create_lab_result"), requireCareTeamAccess("patient_id"), labController.createLabResult);
router.get("/patient/:id", authorizeRoles("doctor", "nurse", "lab_tech", "admin"), authorizePermission("view_lab_result"), requireCareTeamAccess("id"), labController.getLabResultsByPatient);

module.exports = router;
