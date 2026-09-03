const jwt = require("jsonwebtoken");
const { writeAuditLog } = require("./auditMiddleware");

const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            await writeAuditLog({
                req,
                action: "authentication_failed",
                resourceType: "auth",
                userId: null,
                status: "denied",
            });

            return res.status(401).json({
                success: false,
                message: "Authorization header is required",
            });
        }

        const parts = authHeader.split(" ");
        const [scheme, token] = parts;

        if (parts.length !== 2 || !/^Bearer$/i.test(scheme) || !token) {
            await writeAuditLog({
                req,
                action: "authentication_failed",
                resourceType: "auth",
                userId: null,
                status: "denied",
            });

            return res.status(401).json({
                success: false,
                message: "Malformed authorization token",
            });
        }

        if (!process.env.JWT_SECRET) {
            return res.status(401).json({
                success: false,
                message: "Authentication is not configured",
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        return next();
    } catch (error) {
        await writeAuditLog({
            req,
            action: "authentication_failed",
            resourceType: "auth",
            userId: null,
            status: "denied",
        });

        return res.status(401).json({
            success: false,
            message: "Invalid or expired token",
        });
    }
};

module.exports = authenticateToken;
module.exports.authenticateToken = authenticateToken;
