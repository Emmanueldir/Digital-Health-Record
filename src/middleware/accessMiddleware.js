const {
    getAuthenticatedUserId,
    isAdmin,
    isPositiveInteger,
    hasPatientAccess,
} = require("../services/accessService");
const { writeAuditLog } = require("./auditMiddleware");

const resolvePatientId = async (patientId, req) => {
    if (typeof patientId === "function") {
        return patientId(req);
    }

    if (typeof patientId === "string") {
        return req.params[patientId] || req.body[patientId];
    }

    return patientId;
};

const requireCareTeamAccess = (patientId) => {
    return async (req, res, next) => {
        try {
            const resolvedPatientId = await resolvePatientId(patientId, req);

            if (!isPositiveInteger(resolvedPatientId)) {
                return res.status(400).json({
                    success: false,
                    message: "Valid patient id is required",
                });
            }

            req.patientId = Number(resolvedPatientId);

            const hasAccess = await hasPatientAccess({
                req,
                user: req.user,
                patientId: resolvedPatientId,
            });

            if (!hasAccess) {
                await writeAuditLog({
                    req,
                    action: "authorization_denied",
                    resourceType: "patient",
                    resourceId: resolvedPatientId,
                    status: "denied",
                });

                return res.status(403).json({
                    success: false,
                    message: "Care-team access required",
                });
            }

            return next();
        } catch (error) {
            error.message = "Failed to validate care-team access";
            return next(error);
        }
    };
};

module.exports = { requireCareTeamAccess };
