const jwt = require("jsonwebtoken");

const DEFAULT_JWT_EXPIRES_IN = "1d";

const generateToken = ({ id, email, role, permissions = [] }) => {
    if (!process.env.JWT_SECRET) {
        throw new Error("JWT_SECRET is not configured");
    }

    const payload = {
        sub: String(id),
        email,
        role,
    };

    if (permissions.length > 0) {
        payload.permissions = permissions;
    }

    return jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || DEFAULT_JWT_EXPIRES_IN,
    });
};

module.exports = { generateToken };
