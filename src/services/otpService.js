const crypto = require("crypto");
const db = require("../config/db");
const { sendOtpEmail } = require("./emailService");
const { writeAuditLog } = require("../middleware/auditMiddleware");

const OTP_EXPIRY_MINUTES = 10;

const generateOtpCode = () => String(crypto.randomInt(100000, 1000000));

const invalidatePreviousOtps = async (userId) => {
    await db.query(
        "UPDATE otp_verifications SET is_used = TRUE WHERE user_id = ? AND is_used = FALSE",
        [userId]
    );
};

const createAndSendOtp = async ({ req, userId, email, role, action = "OTP_GENERATED" }) => {
    await invalidatePreviousOtps(userId);

    const otp = generateOtpCode();

    await db.query(
        `INSERT INTO otp_verifications (user_id, otp_code, role, expires_at, is_used)
        VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE), FALSE)`,
        [userId, otp, role, OTP_EXPIRY_MINUTES]
    );

    await writeAuditLog({
        req,
        userId,
        action,
        resourceType: "otp",
        status: "success",
    });

    await sendOtpEmail({ to: email, otp });

    await writeAuditLog({
        req,
        userId,
        action: action === "OTP_RESENT" ? "OTP_RESENT" : "OTP_SENT",
        resourceType: "otp",
        status: "success",
    });
};

const findValidOtp = async ({ userId, otp }) => {
    const [rows] = await db.query(
        `SELECT id, role, expires_at
        FROM otp_verifications
        WHERE user_id = ?
        AND otp_code = ?
        AND is_used = FALSE
        ORDER BY created_at DESC
        LIMIT 1`,
        [userId, otp]
    );

    if (rows.length === 0) {
        return null;
    }

    const row = rows[0];

    if (new Date(row.expires_at).getTime() <= Date.now()) {
        await db.query("UPDATE otp_verifications SET is_used = TRUE WHERE id = ?", [row.id]);
        return { ...row, isExpired: true };
    }

    return { ...row, isExpired: false };
};

const markOtpAsUsed = async (otpId) => {
    await db.query("UPDATE otp_verifications SET is_used = TRUE WHERE id = ?", [otpId]);
};

module.exports = {
    createAndSendOtp,
    findValidOtp,
    markOtpAsUsed,
};
