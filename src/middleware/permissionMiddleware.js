const { hasPermission } = require("../services/permissionService");
const { getAuthenticatedUserId, isAdmin } = require("../services/accessService");
const { writeAuditLog } = require("./auditMiddleware");

const authorizePermission = (permissionName) => {
    return async (req, res, next) => {
        try {
            if (isAdmin(req.user)) {
                return next();
            }

            const userId = getAuthenticatedUserId(req.user);
            const allowed = await hasPermission(userId, permissionName);

            if (!allowed) {
                await writeAuditLog({
                    req,
                    action: "authorization_denied",
                    resourceType: "permission",
                    status: "denied",
                });

                return res.status(403).json({
                    success: false,
                    message: "Permission denied",
                });
            }

            return next();
        } catch (error) {
            return next(error);
        }
    };
};

module.exports = { authorizePermission };
