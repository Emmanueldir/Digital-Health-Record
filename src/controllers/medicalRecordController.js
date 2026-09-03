const db = require("../config/db");
const {
    getAuthenticatedUserId,
    isPositiveInteger,
} = require("../services/accessService");
const { writeAuditLog } = require("../middleware/auditMiddleware");
const { notifyPrimaryDoctorOfMedicalRecord } = require("../services/notificationService");

const recordFields = ["diagnosis", "treatment", "prescription", "notes"];
const recordSelect = `SELECT id, patient_id, doctor_id, diagnosis, treatment,
prescription, notes, created_at, updated_at FROM medical_records`;

exports.createMedicalRecord = async (req, res, next) => {
    try {
        const { patient_id, diagnosis, treatment, prescription, notes } = req.body;
        const doctorId = getAuthenticatedUserId(req.user);

        if (!isPositiveInteger(patient_id) || !diagnosis) {
            return res.status(400).json({
                success: false,
                message: "patient_id and diagnosis are required",
            });
        }

        const [patientRows] = await db.query("SELECT id FROM patients WHERE id = ?", [patient_id]);

        if (patientRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Patient not found",
            });
        }

        const [result] = await db.query(
            `INSERT INTO medical_records
            (patient_id, doctor_id, diagnosis, treatment, prescription, notes)
            VALUES (?, ?, ?, ?, ?, ?)`,
            [
                patient_id,
                doctorId,
                diagnosis,
                treatment || null,
                prescription || null,
                notes || null,
            ]
        );

        const [records] = await db.query(`${recordSelect} WHERE id = ?`, [result.insertId]);

        await writeAuditLog({
            req,
            action: "create",
            resourceType: "medical_record",
            resourceId: result.insertId,
            status: "success",
        });

        await notifyPrimaryDoctorOfMedicalRecord({
            req,
            patientId: patient_id,
            recordId: result.insertId,
        });

        return res.status(201).json({
            success: true,
            message: "Medical record created successfully",
            data: records[0],
        });
    } catch (error) {
        error.message = "Failed to create medical record";
        return next(error);
    }
};

exports.getRecordsByPatient = async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!isPositiveInteger(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid patient id",
            });
        }

        const [records] = await db.query(
            `${recordSelect}
            WHERE patient_id = ?
            ORDER BY created_at DESC`,
            [id]
        );

        await writeAuditLog({
            req,
            action: "view",
            resourceType: "medical_record",
            resourceId: id,
            status: "success",
        });

        return res.status(200).json({
            success: true,
            message: "Medical records retrieved successfully",
            data: records,
        });
    } catch (error) {
        error.message = "Failed to retrieve medical records";
        return next(error);
    }
};

exports.getMedicalRecordById = async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!isPositiveInteger(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid medical record id",
            });
        }

        const [records] = await db.query(`${recordSelect} WHERE id = ?`, [id]);

        if (records.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Medical record not found",
            });
        }

        await writeAuditLog({
            req,
            action: "view",
            resourceType: "medical_record",
            resourceId: id,
            status: "success",
        });

        return res.status(200).json({
            success: true,
            message: "Medical record retrieved successfully",
            data: records[0],
        });
    } catch (error) {
        error.message = "Failed to retrieve medical record";
        return next(error);
    }
};

exports.updateMedicalRecord = async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!isPositiveInteger(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid medical record id",
            });
        }

        const updates = recordFields.filter((field) =>
            Object.prototype.hasOwnProperty.call(req.body, field)
        );

        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No medical record fields provided for update",
            });
        }

        const setClause = updates.map((field) => `${field} = ?`).join(", ");
        const values = updates.map((field) => req.body[field]);

        const [result] = await db.query(
            `UPDATE medical_records SET ${setClause} WHERE id = ?`,
            [...values, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Medical record not found",
            });
        }

        const [records] = await db.query(`${recordSelect} WHERE id = ?`, [id]);

        await writeAuditLog({
            req,
            action: "update",
            resourceType: "medical_record",
            resourceId: id,
            status: "success",
        });

        return res.status(200).json({
            success: true,
            message: "Medical record updated successfully",
            data: records[0],
        });
    } catch (error) {
        error.message = "Failed to update medical record";
        return next(error);
    }
};
