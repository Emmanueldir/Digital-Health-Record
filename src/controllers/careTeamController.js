const db = require("../config/db");
const {
    canManageCareTeam,
    getAuthenticatedUserId,
    isPositiveInteger,
} = require("../services/accessService");
const { writeAuditLog } = require("../middleware/auditMiddleware");
const { notifyCareTeamAssignment } = require("../services/notificationService");

exports.getPatientCareTeam = async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!isPositiveInteger(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid patient id",
            });
        }

        const [members] = await db.query(
            `SELECT
                pct.id,
                pct.patient_id,
                pct.user_id,
                u.username AS staff_name,
                u.email AS staff_email,
                GROUP_CONCAT(DISTINCT r.name ORDER BY r.name SEPARATOR ', ') AS staff_role,
                pct.role AS assignment_role,
                pct.assigned_by,
                pct.is_active,
                pct.created_at
            FROM patient_care_team pct
            INNER JOIN users u ON u.id = pct.user_id
            LEFT JOIN user_roles ur ON ur.user_id = u.id
            LEFT JOIN roles r ON r.id = ur.role_id
            WHERE pct.patient_id = ?
            GROUP BY pct.id, pct.patient_id, pct.user_id, u.username, u.email,
                pct.role, pct.assigned_by, pct.is_active, pct.created_at
            ORDER BY pct.is_active DESC, pct.created_at DESC`,
            [id]
        );

        await writeAuditLog({
            req,
            action: "view",
            resourceType: "care_team",
            resourceId: id,
            status: "success",
        });

        return res.status(200).json({
            success: true,
            message: "Care team retrieved successfully",
            data: members,
        });
    } catch (error) {
        error.message = "Failed to retrieve care team";
        return next(error);
    }
};

exports.getAssignableStaff = async (req, res, next) => {
    try {
        const [staff] = await db.query(
            `SELECT
                u.id,
                u.username,
                u.email,
                GROUP_CONCAT(DISTINCT r.name ORDER BY r.name SEPARATOR ', ') AS roles
            FROM users u
            INNER JOIN user_roles ur ON ur.user_id = u.id
            INNER JOIN roles r ON r.id = ur.role_id
            WHERE LOWER(r.name) IN ('admin', 'doctor', 'nurse', 'lab technician')
            AND u.status = 'active'
            GROUP BY u.id, u.username, u.email
            ORDER BY u.username ASC`
        );

        return res.status(200).json({
            success: true,
            message: "Assignable staff retrieved successfully",
            data: staff,
        });
    } catch (error) {
        error.message = "Failed to retrieve assignable staff";
        return next(error);
    }
};

exports.assignCareTeamMember = async (req, res, next) => {
    try {
        const { patient_id, user_id, role } = req.body;

        if (!isPositiveInteger(patient_id) || !isPositiveInteger(user_id) || !role) {
            return res.status(400).json({
                success: false,
                message: "patient_id, user_id, and role are required",
            });
        }

        const canManage = await canManageCareTeam(req.user, patient_id);

        if (!canManage) {
            await writeAuditLog({
                req,
                action: "authorization_denied",
                resourceType: "care_team",
                resourceId: patient_id,
                status: "denied",
            });

            return res.status(403).json({
                success: false,
                message: "Not authorized to manage this care team",
            });
        }

        const [patientRows] = await db.query("SELECT id FROM patients WHERE id = ?", [patient_id]);

        if (patientRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Patient not found",
            });
        }

        const [userRows] = await db.query("SELECT id FROM users WHERE id = ?", [user_id]);

        if (userRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        const [result] = await db.query(
            `INSERT INTO patient_care_team
            (patient_id, user_id, role, assigned_by, is_active)
            VALUES (?, ?, ?, ?, TRUE)`,
            [patient_id, user_id, role, getAuthenticatedUserId(req.user)]
        );

        const [members] = await db.query(
            "SELECT * FROM patient_care_team WHERE id = ?",
            [result.insertId]
        );

        await writeAuditLog({
            req,
            action: "create",
            resourceType: "care_team",
            resourceId: result.insertId,
            status: "success",
        });

        await notifyCareTeamAssignment({
            req,
            userId: user_id,
            careTeamId: result.insertId,
        });

        return res.status(201).json({
            success: true,
            message: "Care-team member assigned successfully",
            data: members[0],
        });
    } catch (error) {
        error.message = "Failed to assign care-team member";
        return next(error);
    }
};

exports.deactivateCareTeamMember = async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!isPositiveInteger(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid care-team member id",
            });
        }

        const [members] = await db.query(
            "SELECT id, patient_id FROM patient_care_team WHERE id = ?",
            [id]
        );

        if (members.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Care-team member not found",
            });
        }

        const canManage = await canManageCareTeam(req.user, members[0].patient_id);

        if (!canManage) {
            await writeAuditLog({
                req,
                action: "authorization_denied",
                resourceType: "care_team",
                resourceId: id,
                status: "denied",
            });

            return res.status(403).json({
                success: false,
                message: "Not authorized to manage this care team",
            });
        }

        await db.query(
            "UPDATE patient_care_team SET is_active = FALSE WHERE id = ?",
            [id]
        );

        const [updatedMembers] = await db.query(
            "SELECT * FROM patient_care_team WHERE id = ?",
            [id]
        );

        await writeAuditLog({
            req,
            action: "update",
            resourceType: "care_team",
            resourceId: id,
            status: "success",
        });

        return res.status(200).json({
            success: true,
            message: "Care-team member deactivated successfully",
            data: updatedMembers[0],
        });
    } catch (error) {
        error.message = "Failed to deactivate care-team member";
        return next(error);
    }
};
