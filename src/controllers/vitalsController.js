const db = require("../config/db");
const {
    getAuthenticatedUserId,
    isPositiveInteger,
} = require("../services/accessService");
const { writeAuditLog } = require("../middleware/auditMiddleware");

exports.createVitals = async (req, res, next) => {
    try {
        const {
            patient_id,
            blood_pressure,
            temperature,
            pulse,
            weight,
            height,
            notes,
        } = req.body;

        if (!isPositiveInteger(patient_id)) {
            return res.status(400).json({
                success: false,
                message: "Valid patient_id is required",
            });
        }

        const [patients] = await db.query("SELECT id FROM patients WHERE id = ?", [patient_id]);

        if (patients.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Patient not found",
            });
        }

        const [result] = await db.query(
            `INSERT INTO vitals
            (patient_id, recorded_by, blood_pressure, temperature, pulse, weight, height, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                patient_id,
                getAuthenticatedUserId(req.user),
                blood_pressure || null,
                temperature || null,
                pulse || null,
                weight || null,
                height || null,
                notes || null,
            ]
        );

        const [vitals] = await db.query("SELECT * FROM vitals WHERE id = ?", [result.insertId]);

        await writeAuditLog({
            req,
            action: "create",
            resourceType: "vitals",
            resourceId: result.insertId,
            status: "success",
        });

        return res.status(201).json({
            success: true,
            message: "Vitals recorded successfully",
            data: vitals[0],
        });
    } catch (error) {
        error.message = "Failed to record vitals";
        return next(error);
    }
};

exports.getVitalsByPatient = async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!isPositiveInteger(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid patient id",
            });
        }

        const [vitals] = await db.query(
            `SELECT id, patient_id, recorded_by, blood_pressure, temperature,
            pulse, weight, height, notes, created_at
            FROM vitals
            WHERE patient_id = ?
            ORDER BY created_at DESC`,
            [id]
        );

        await writeAuditLog({
            req,
            action: "view",
            resourceType: "vitals",
            resourceId: id,
            status: "success",
        });

        return res.status(200).json({
            success: true,
            message: "Vitals retrieved successfully",
            data: vitals,
        });
    } catch (error) {
        error.message = "Failed to retrieve vitals";
        return next(error);
    }
};
