const express = require("express");
const router = express.Router();

const authenticateToken = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/rbacMiddleware");
const { authorizePermission } = require("../middleware/permissionMiddleware");
const { requireCareTeamAccess } = require("../middleware/accessMiddleware");
const auditController = require("../controllers/auditController");

router.use(authenticateToken);

router.get("/", authorizeRoles("admin"), authorizePermission("view_audit_logs"), auditController.getAuditLogs);
router.get("/patient/:id", authorizeRoles("doctor", "nurse", "admin"), authorizePermission("view_patient_timeline"), requireCareTeamAccess("id"), auditController.getPatientAuditLogs);
router.get("/user/:id", authorizeRoles("admin"), authorizePermission("view_audit_logs"), auditController.getUserAuditLogs);

module.exports = router;
