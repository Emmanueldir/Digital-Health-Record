const express = require("express");
const router = express.Router();

const authenticateToken = require("../middleware/authMiddleware");
const { authorizePermission } = require("../middleware/permissionMiddleware");
const { validateRequest } = require("../middleware/validationMiddleware");
const permissionController = require("../controllers/permissionController");
const { createPermissionValidator } = require("../validators/permissionValidators");

router.use(authenticateToken);
router.use(authorizePermission("manage_permissions"));

router.get("/", permissionController.getPermissions);
router.post("/", createPermissionValidator, validateRequest, permissionController.createPermission);

module.exports = router;
