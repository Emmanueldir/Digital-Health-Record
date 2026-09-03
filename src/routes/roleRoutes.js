const express = require("express");
const router = express.Router();

const authenticateToken = require("../middleware/authMiddleware");
const { authorizePermission } = require("../middleware/permissionMiddleware");
const { validateRequest } = require("../middleware/validationMiddleware");
const roleController = require("../controllers/roleController");
const {
    roleIdParamValidator,
    rolePermissionParamValidator,
    createRoleValidator,
    updateRoleValidator,
    assignPermissionValidator,
} = require("../validators/roleValidators");

router.use(authenticateToken);
router.use(authorizePermission("manage_roles"));

router.get("/", roleController.getRoles);
router.post("/", createRoleValidator, validateRequest, roleController.createRole);
router.put("/:id", updateRoleValidator, validateRequest, roleController.updateRole);
router.delete("/:id", roleIdParamValidator, validateRequest, roleController.deleteRole);
router.get("/:roleId/permissions", rolePermissionParamValidator, validateRequest, roleController.getRolePermissions);
router.post("/:roleId/permissions", assignPermissionValidator, validateRequest, roleController.assignPermission);
router.delete("/:roleId/permissions/:permissionId", rolePermissionParamValidator, validateRequest, roleController.removePermission);

module.exports = router;
