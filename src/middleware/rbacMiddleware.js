const normalizeRole = (role) => {
    const normalized = String(role || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
    return normalized === "lab_technician" ? "lab_tech" : normalized;
};
const { writeAuditLog } = require("./auditMiddleware");

const authorizeRoles = (...roles) => {
    const allowedRoles = roles.map(normalizeRole);

    return async (req, res, next) => {
        const userRole = req.user && req.user.role;

        if (!userRole || !allowedRoles.includes(normalizeRole(userRole))) {
            await writeAuditLog({
                req,
                action: "authorization_denied",
                resourceType: "rbac",
                status: "denied",
            });

            return res.status(403).json({
                success: false,
                message: "Forbidden",
            });
        }

        return next();
    };
};

module.exports = { authorizeRoles };
