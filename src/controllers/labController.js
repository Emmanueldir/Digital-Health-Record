const db = require("../config/db");
const {
    getAuthenticatedUserId,
    isPositiveInteger,
} = require("../services/accessService");
const { writeAuditLog } = require("../middleware/auditMiddleware");
const { notifyPrimaryDoctorOfLabResult } = require("../services/notificationService");

exports.createLabResult = async (req, res, next) => {
    try {
        const { patient_id, test_type, result, file_url } = req.body;

        if (!isPositiveInteger(patient_id) || !test_type || !result) {
            return res.status(400).json({
                success: false,
                message: "patient_id, test_type, and result are required",
            });
        }

        const [patients] = await db.query("SELECT id FROM patients WHERE id = ?", [patient_id]);

        if (patients.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Patient not found",
            });
        }

        const [insertResult] = await db.query(
            `INSERT INTO lab_results
            (patient_id, test_type, result, file_url, requested_by)
            VALUES (?, ?, ?, ?, ?)`,
            [
                patient_id,
                test_type,
                result,
                file_url || null,
                getAuthenticatedUserId(req.user)
            ]
        );

        const [labs] = await db.query(
            "SELECT * FROM lab_results WHERE id = ?",
            [insertResult.insertId]
        );

        await writeAuditLog({
            req,
            action: "create",
            resourceType: "lab_result",
            resourceId: insertResult.insertId,
            status: "success",
        });

        await notifyPrimaryDoctorOfLabResult({
            req,
            patientId: patient_id,
            labResultId: insertResult.insertId,
        });

        return res.status(201).json({
            success: true,
            message: "Lab result created successfully",
            data: labs[0],
        });
    } catch (error) {
        error.message = "Failed to create lab result";
        return next(error);
    }
};

exports.getLabResultsByPatient = async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!isPositiveInteger(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid patient id",
            });
        }

        const [labs] = await db.query(
            `SELECT id, patient_id, test_type, result, file_url, requested_by, created_at
            FROM lab_results
            WHERE patient_id = ?
            ORDER BY created_at DESC`,
            [id]
        );

        await writeAuditLog({
            req,
            action: "view",
            resourceType: "lab_result",
            resourceId: id,
            status: "success",
        });

        return res.status(200).json({
            success: true,
            message: "Lab results retrieved successfully",
            data: labs,
        });
    } catch (error) {
        error.message = "Failed to retrieve lab results";
        return next(error);
    }
};
