const express = require("express");
const router = express.Router();

const authenticateToken = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/rbacMiddleware");
const { authorizePermission } = require("../middleware/permissionMiddleware");
const { validateRequest } = require("../middleware/validationMiddleware");
const { createBreakGlassRequestValidator } = require("../validators/breakGlassValidators");
const breakGlassController = require("../controllers/breakGlassController");

router.use(authenticateToken);

router.post("/request", createBreakGlassRequestValidator, validateRequest, authorizeRoles("admin", "doctor", "nurse"), authorizePermission("request_break_glass"), breakGlassController.createBreakGlassRequest);
router.post("/:id/approve", authorizeRoles("admin"), authorizePermission("approve_break_glass"), breakGlassController.approveBreakGlassRequest);
router.post("/:id/reject", authorizeRoles("admin"), authorizePermission("approve_break_glass"), breakGlassController.rejectBreakGlassRequest);
router.get("/", authorizeRoles("admin"), authorizePermission("view_break_glass"), breakGlassController.getBreakGlassRequests);
router.get("/my-requests", breakGlassController.getMyBreakGlassRequests);

module.exports = router;
