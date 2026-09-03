const db = require("../config/db");
const bcrypt = require("bcrypt");
const { generateToken } = require("../services/tokenService");
const { writeAuditLog } = require("../middleware/auditMiddleware");
const { createAndSendOtp, findValidOtp, markOtpAsUsed } = require("../services/otpService");
const { normalizeRole: normalizeAccessRole } = require("../services/accessService");

const AUTH_ERROR = {
  success: false,
  message: "Invalid email or password",
};

const normalizeRole = normalizeAccessRole;
const staffRoles = new Set(["admin", "doctor", "nurse", "lab_tech"]);

const buildError = (message) => ({
  success: false,
  message,
});

const isStaffRole = (role) => staffRoles.has(normalizeAccessRole(role));

const issueLoginResponse = async ({ req, res, user, selectedRole }) => {
  const accessToken = generateToken({
    id: user.id,
    email: user.email,
    role: selectedRole.name,
    permissions: selectedRole.permissions,
  });

  await db.query("UPDATE users SET last_login = NOW() WHERE id = ?", [
    user.id,
  ]);

  await writeAuditLog({
    req,
    userId: user.id,
    action: "login",
    resourceType: "auth",
    status: "success",
  });

  return res.status(200).json({
    success: true,
    message: "Login successful",
    accessToken,
    token: accessToken,
    user: {
      id: user.id,
      email: user.email,
      role: selectedRole.name,
    },
  });
};

const assignDefaultPatientRole = async (userId) => {
  const [roles] = await db.query("SELECT id FROM roles WHERE name = ? LIMIT 1", [
    "Patient",
  ]);

  if (roles.length === 0) {
    const error = new Error("Default Patient role is not configured");
    error.statusCode = 500;
    throw error;
  }

  await db.query(
    "INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)",
    [userId, roles[0].id]
  );
};

const getUserRoles = async (userId) => {
  const [rows] = await db.query(
    `SELECT
      r.id AS role_id,
      r.name AS role,
      p.name AS permission
    FROM user_roles ur
    INNER JOIN roles r ON r.id = ur.role_id
    LEFT JOIN role_permissions rp ON rp.role_id = r.id
    LEFT JOIN permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = ?`,
    [userId]
  );

  const rolesByName = new Map();

  rows.forEach((row) => {
    if (!rolesByName.has(row.role)) {
      rolesByName.set(row.role, {
        id: row.role_id,
        name: row.role,
        permissions: [],
      });
    }

    if (row.permission) {
      rolesByName.get(row.role).permissions.push(row.permission);
    }
  });

  return Array.from(rolesByName.values());
};

const resolveLoginRole = (assignedRoles, requestedRole) => {
  if (assignedRoles.length === 0) {
    return {
      status: 403,
      error: buildError("No roles are assigned to this user"),
    };
  }

  if (!requestedRole && assignedRoles.length === 1) {
    return { role: assignedRoles[0] };
  }

  if (!requestedRole) {
    return {
      status: 400,
      error: buildError("Role is required for users with multiple roles"),
    };
  }

  const role = assignedRoles.find(
    (assignedRole) =>
      normalizeRole(assignedRole.name) === normalizeRole(requestedRole)
  );

  if (!role) {
    return {
      status: 403,
      error: buildError("User is not authorized for the requested role"),
    };
  }

  return { role };
};

// REGISTER USER
exports.register = async (req, res) => {
  try {
    const { username, email, password, phone } = req.body;

    // check if user exists
    const [existing] = await db.query("SELECT * FROM users WHERE email = ?", [
      email,
    ]);

    if (existing.length > 0) {
      return res.status(400).json({ message: "User already exists" });
    }

    if (!password) {
      return res.status(400).json({
        message: "Password is missing",
      });
    }
    
    // hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // insert user
    const [result] = await db.query(
      "INSERT INTO users (username, email, password_hash, phone) VALUES (?, ?, ?, ?)",
      [username, email, hashedPassword, phone]
    );

    await assignDefaultPatientRole(result.insertId);

    return res.status(201).json({
      message: "User registered successfully",
      userId: result.insertId,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// LOGIN USER
exports.login = async (req, res) => {
  try {
    const { email, password, role } = req.body;
    const requestedRole = typeof role === "string" ? role.trim() : role;

    if (!email || !password) {
      return res.status(400).json(buildError("Email and password are required"));
    }

    if (role !== undefined && role !== null && typeof role !== "string") {
      return res.status(400).json(buildError("Role must be a string"));
    }

    const [users] = await db.query(
      "SELECT id, email, password_hash, status FROM users WHERE email = ?",
      [email]
    );

    if (users.length === 0) {
      await writeAuditLog({
        req,
        userId: null,
        action: "authentication_failed",
        resourceType: "auth",
        status: "denied",
      });

      return res.status(401).json(AUTH_ERROR);
    }

    const user = users[0];

    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      await writeAuditLog({
        req,
        userId: user.id,
        action: "authentication_failed",
        resourceType: "auth",
        status: "denied",
      });

      return res.status(401).json(AUTH_ERROR);
    }

    if (user.status && user.status !== "active") {
      await writeAuditLog({
        req,
        userId: user.id,
        action: "authentication_failed",
        resourceType: "auth",
        status: "denied",
      });

      return res.status(403).json(buildError("User account is not active"));
    }

    const assignedRoles = await getUserRoles(user.id);
    const roleResult = resolveLoginRole(assignedRoles, requestedRole);

    if (roleResult.error) {
      await writeAuditLog({
        req,
        userId: user.id,
        action: "authorization_denied",
        resourceType: "auth",
        status: "denied",
      });

      return res.status(roleResult.status).json(roleResult.error);
    }

    const selectedRole = roleResult.role;

    if (isStaffRole(selectedRole.name)) {
      await createAndSendOtp({
        req,
        userId: user.id,
        email: user.email,
        role: selectedRole.name,
      });

      return res.status(200).json({
        success: true,
        requiresOtp: true,
        message: "OTP verification required",
      });
    }

    return issueLoginResponse({ req, res, user, selectedRole });
  } catch (error) {
    console.error(error);
    return res.status(500).json(buildError("Login failed"));
  }
};

exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const [users] = await db.query(
      "SELECT id, email, status FROM users WHERE email = ?",
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json(AUTH_ERROR);
    }

    const user = users[0];

    if (user.status && user.status !== "active") {
      return res.status(403).json(buildError("User account is not active"));
    }

    const otpRecord = await findValidOtp({ userId: user.id, otp });

    if (!otpRecord || otpRecord.isExpired) {
      await writeAuditLog({
        req,
        userId: user.id,
        action: "OTP_FAILED",
        resourceType: "otp",
        status: "denied",
      });

      return res.status(401).json(buildError("Invalid or expired OTP"));
    }

    const assignedRoles = await getUserRoles(user.id);
    const roleResult = resolveLoginRole(assignedRoles, otpRecord.role);

    if (roleResult.error || !isStaffRole(roleResult.role.name)) {
      await writeAuditLog({
        req,
        userId: user.id,
        action: "OTP_FAILED",
        resourceType: "otp",
        status: "denied",
      });

      return res.status(403).json(buildError("OTP is not authorized for this user"));
    }

    await markOtpAsUsed(otpRecord.id);

    await writeAuditLog({
      req,
      userId: user.id,
      action: "OTP_VERIFIED",
      resourceType: "otp",
      status: "success",
    });

    return issueLoginResponse({
      req,
      res,
      user,
      selectedRole: roleResult.role,
    });
  } catch (error) {
    return res.status(500).json(buildError("OTP verification failed"));
  }
};

exports.resendOtp = async (req, res) => {
  try {
    const { email, role } = req.body;

    const [users] = await db.query(
      "SELECT id, email, status FROM users WHERE email = ?",
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json(AUTH_ERROR);
    }

    const user = users[0];

    if (user.status && user.status !== "active") {
      return res.status(403).json(buildError("User account is not active"));
    }

    const assignedRoles = await getUserRoles(user.id);
    const roleResult = resolveLoginRole(
      assignedRoles,
      typeof role === "string" ? role.trim() : role
    );

    if (roleResult.error) {
      return res.status(roleResult.status).json(roleResult.error);
    }

    if (!isStaffRole(roleResult.role.name)) {
      return res.status(400).json(buildError("OTP is not required for this role"));
    }

    await createAndSendOtp({
      req,
      userId: user.id,
      email: user.email,
      role: roleResult.role.name,
      action: "OTP_RESENT",
    });

    return res.status(200).json({
      success: true,
      requiresOtp: true,
      message: "OTP resent successfully",
    });
  } catch (error) {
    return res.status(500).json(buildError("OTP resend failed"));
  }
};
