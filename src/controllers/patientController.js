const db = require("../config/db");
const {
    getAuthenticatedUserId,
    isAdmin,
    isPositiveInteger,
    normalizeRole,
} = require("../services/accessService");
const { writeAuditLog } = require("../middleware/auditMiddleware");
const {
    assignQrToPatient,
    getPatientQr: getPatientQrData,
    lookupPatientByQrIdentifier,
} = require("../services/qrService");

const patientFields = [
    "patient_code",
    "user_id",
    "full_name",
    "gender",
    "date_of_birth",
    "address",
    "phone",
    "emergency_contact",
    "qr_token",
];

const patientSelect = `SELECT id, patient_code, user_id, full_name, gender, date_of_birth,
address, phone, emergency_contact, qr_token, qr_identifier, created_at FROM patients`;

exports.createPatient = async (req, res, next) => {
    try {
        const {
            patient_code,
            user_id,
            full_name,
            gender,
            date_of_birth,
            address,
            phone,
            emergency_contact,
            qr_token,
        } = req.body;

        if (!patient_code || !full_name) {
            return res.status(400).json({
                success: false,
                message: "patient_code and full_name are required",
            });
        }

        const [result] = await db.query(
            `INSERT INTO patients
            (patient_code, user_id, full_name, gender, date_of_birth, address, phone, emergency_contact, qr_token)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                patient_code,
                user_id || null,
                full_name,
                gender || null,
                date_of_birth || null,
                address || null,
                phone || null,
                emergency_contact || null,
                qr_token || null,
            ]
        );

        await assignQrToPatient({ req, patientId: result.insertId });

        const [patients] = await db.query(`${patientSelect} WHERE id = ?`, [result.insertId]);
        const authenticatedUserId = getAuthenticatedUserId(req.user);

        if (normalizeRole(req.user && req.user.role) === "doctor") {
            const [primaryDoctors] = await db.query(
                `SELECT id
                FROM patient_care_team
                WHERE patient_id = ?
                AND role = ?
                AND is_active = TRUE
                LIMIT 1`,
                [result.insertId, "PRIMARY_DOCTOR"]
            );

            if (primaryDoctors.length === 0) {
                await db.query(
                    `INSERT INTO patient_care_team
                    (patient_id, user_id, role, assigned_by, is_active)
                    VALUES (?, ?, ?, ?, TRUE)`,
                    [result.insertId, authenticatedUserId, "PRIMARY_DOCTOR", authenticatedUserId]
                );

                await writeAuditLog({
                    req,
                    action: "create",
                    resourceType: "care_team",
                    resourceId: result.insertId,
                    status: "success",
                });
            }
        }

        await writeAuditLog({
            req,
            action: "create",
            resourceType: "patient",
            resourceId: result.insertId,
            status: "success",
        });

        return res.status(201).json({
            success: true,
            message: "Patient created successfully",
            data: patients[0],
        });
    } catch (error) {
        error.message = "Failed to create patient";
        return next(error);
    }
};

exports.getPatientQr = async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!isPositiveInteger(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid patient id",
            });
        }

        const qrData = await getPatientQrData({ req, patientId: id });

        return res.status(200).json({
            success: true,
            message: "Patient QR retrieved successfully",
            data: qrData,
        });
    } catch (error) {
        return next(error);
    }
};

exports.lookupPatientByQr = async (req, res, next) => {
    try {
        const { identifier } = req.params;

        const patient = await lookupPatientByQrIdentifier({
            req,
            qrIdentifier: identifier,
        });

        return res.status(200).json({
            success: true,
            message: "Patient QR lookup successful",
            data: patient,
        });
    } catch (error) {
        return next(error);
    }
};

exports.getPatients = async (req, res, next) => {
    try {
        let patients;

        if (isAdmin(req.user)) {
            [patients] = await db.query(`${patientSelect} ORDER BY created_at DESC`);
        } else {
            [patients] = await db.query(
                `${patientSelect}
                WHERE id IN (
                    SELECT patient_id
                    FROM patient_care_team
                    WHERE user_id = ?
                    AND is_active = TRUE
                )
                ORDER BY created_at DESC`,
                [getAuthenticatedUserId(req.user)]
            );
        }

        await writeAuditLog({
            req,
            action: "view",
            resourceType: "patient",
            status: "success",
        });

        return res.status(200).json({
            success: true,
            message: "Patients retrieved successfully",
            data: patients,
        });
    } catch (error) {
        error.message = "Failed to retrieve patients";
        return next(error);
    }
};

exports.getPatientById = async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!isPositiveInteger(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid patient id",
            });
        }

        const [patients] = await db.query(`${patientSelect} WHERE id = ?`, [id]);

        if (patients.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Patient not found",
            });
        }

        await writeAuditLog({
            req,
            action: "view",
            resourceType: "patient",
            resourceId: id,
            status: "success",
        });

        return res.status(200).json({
            success: true,
            message: "Patient retrieved successfully",
            data: patients[0],
        });
    } catch (error) {
        error.message = "Failed to retrieve patient";
        return next(error);
    }
};

exports.updatePatient = async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!isPositiveInteger(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid patient id",
            });
        }

        const updates = patientFields.filter((field) =>
            Object.prototype.hasOwnProperty.call(req.body, field)
        );

        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No patient fields provided for update",
            });
        }

        const setClause = updates.map((field) => `${field} = ?`).join(", ");
        const values = updates.map((field) => req.body[field]);

        const [result] = await db.query(
            `UPDATE patients SET ${setClause} WHERE id = ?`,
            [...values, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Patient not found",
            });
        }

        const [patients] = await db.query(`${patientSelect} WHERE id = ?`, [id]);

        await writeAuditLog({
            req,
            action: "update",
            resourceType: "patient",
            resourceId: id,
            status: "success",
        });

        return res.status(200).json({
            success: true,
            message: "Patient updated successfully",
            data: patients[0],
        });
    } catch (error) {
        error.message = "Failed to update patient";
        return next(error);
    }
};

exports.deletePatient = async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!isPositiveInteger(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid patient id",
            });
        }

        const [result] = await db.query("DELETE FROM patients WHERE id = ?", [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Patient not found",
            });
        }

        await writeAuditLog({
            req,
            action: "delete",
            resourceType: "patient",
            resourceId: id,
            status: "success",
        });

        return res.status(200).json({
            success: true,
            message: "Patient deleted successfully",
            data: { id: Number(id) },
        });
    } catch (error) {
        error.message = "Failed to delete patient";
        return next(error);
    }
};
