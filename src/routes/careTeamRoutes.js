const express = require("express");
const router = express.Router();

const authenticateToken = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/rbacMiddleware");
const { authorizePermission } = require("../middleware/permissionMiddleware");
const { requireCareTeamAccess } = require("../middleware/accessMiddleware");
const { validateRequest } = require("../middleware/validationMiddleware");
const {
    assignCareTeamMemberValidator,
    patientCareTeamValidator,
    deactivateCareTeamMemberValidator,
} = require("../validators/careTeamValidators");
const careTeamController = require("../controllers/careTeamController");

router.use(authenticateToken);

router.get("/staff", authorizeRoles("admin", "doctor"), authorizePermission("assign_roles"), careTeamController.getAssignableStaff);
router.get("/patient/:id", patientCareTeamValidator, validateRequest, authorizeRoles("admin", "doctor", "nurse"), authorizePermission("view_patient"), requireCareTeamAccess("id"), careTeamController.getPatientCareTeam);
router.post("/", assignCareTeamMemberValidator, validateRequest, authorizeRoles("admin", "doctor"), authorizePermission("assign_roles"), careTeamController.assignCareTeamMember);
router.put("/:id/deactivate", deactivateCareTeamMemberValidator, validateRequest, authorizeRoles("admin", "doctor"), authorizePermission("assign_roles"), careTeamController.deactivateCareTeamMember);

module.exports = router;
