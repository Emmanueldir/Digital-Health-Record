const express = require("express");
const router = express.Router();

const authenticateToken = require("../middleware/authMiddleware");
const { authorizePermission } = require("../middleware/permissionMiddleware");
const { validateRequest } = require("../middleware/validationMiddleware");
const userRoleController = require("../controllers/userRoleController");
const {
    userIdParamValidator,
    assignUserRoleValidator,
    removeUserRoleValidator,
} = require("../validators/userRoleValidators");

router.use(authenticateToken);
router.use(authorizePermission("manage_users"));

router.get("/:id/roles", userIdParamValidator, validateRequest, userRoleController.getUserRoles);
router.post("/:id/roles", assignUserRoleValidator, validateRequest, userRoleController.assignRole);
router.delete("/:id/roles/:roleId", removeUserRoleValidator, validateRequest, userRoleController.removeRole);

module.exports = router;
