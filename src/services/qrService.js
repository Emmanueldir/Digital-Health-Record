const QRCode = require("qrcode");

const db = require("../config/db");
const { writeAuditLog } = require("../middleware/auditMiddleware");
const { isPositiveInteger } = require("./accessService");

const QR_IDENTIFIER_PREFIX = "PAT";

const formatQrIdentifier = (patientId) =>
    `${QR_IDENTIFIER_PREFIX}-${String(patientId).padStart(6, "0")}`;

const generateQrImage = async (qrIdentifier) => QRCode.toDataURL(qrIdentifier);

const assignQrToPatient = async ({ req, patientId }) => {
    if (!isPositiveInteger(patientId)) {
        const error = new Error("Valid patient id is required");
        error.statusCode = 400;
        throw error;
    }

    const [patients] = await db.query(
        "SELECT id, qr_identifier, qr_image_url FROM patients WHERE id = ?",
        [patientId]
    );

    if (patients.length === 0) {
        const error = new Error("Patient not found");
        error.statusCode = 404;
        throw error;
    }

    if (patients[0].qr_identifier && patients[0].qr_image_url) {
        return {
            patientId: patients[0].id,
            qrIdentifier: patients[0].qr_identifier,
            qrImage: patients[0].qr_image_url,
        };
    }

    const qrIdentifier = patients[0].qr_identifier || formatQrIdentifier(patientId);
    const qrImage = await generateQrImage(qrIdentifier);

    await db.query(
        "UPDATE patients SET qr_identifier = ?, qr_image_url = ? WHERE id = ?",
        [qrIdentifier, qrImage, patientId]
    );

    await writeAuditLog({
        req,
        action: "QR_GENERATED",
        resourceType: "patient",
        resourceId: patientId,
        status: "success",
    });

    return {
        patientId: Number(patientId),
        qrIdentifier,
        qrImage,
    };
};

const getPatientQr = async ({ req, patientId }) => assignQrToPatient({ req, patientId });

const getPatientIdByQrIdentifier = async (qrIdentifier) => {
    const [rows] = await db.query(
        "SELECT id FROM patients WHERE qr_identifier = ?",
        [qrIdentifier]
    );

    return rows.length > 0 ? rows[0].id : null;
};

const lookupPatientByQrIdentifier = async ({ req, qrIdentifier }) => {
    const [patients] = await db.query(
        `SELECT id, patient_code, full_name, qr_identifier
        FROM patients
        WHERE qr_identifier = ?`,
        [qrIdentifier]
    );

    if (patients.length === 0) {
        const error = new Error("Patient not found");
        error.statusCode = 404;
        throw error;
    }

    await writeAuditLog({
        req,
        action: "QR_SCANNED",
        resourceType: "patient",
        resourceId: patients[0].id,
        status: "success",
    });

    return {
        patientId: patients[0].id,
        patientCode: patients[0].patient_code,
        fullName: patients[0].full_name,
        qrIdentifier: patients[0].qr_identifier,
    };
};

module.exports = {
    formatQrIdentifier,
    generateQrImage,
    assignQrToPatient,
    getPatientQr,
    getPatientIdByQrIdentifier,
    lookupPatientByQrIdentifier,
};
