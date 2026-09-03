const fs = require("fs/promises");
const path = require("path");

const db = require("../config/db");
const {
    getAuthenticatedUserId,
    isAdmin,
    isPositiveInteger,
} = require("./accessService");

const UPLOAD_ROOT = path.join(__dirname, "..", "..", "uploads");
const PATIENT_UPLOAD_DIR = path.join(UPLOAD_ROOT, "patients");
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([".pdf", ".jpg", ".jpeg", ".png"]);
const ALLOWED_MIME_TYPES = new Set([
    "application/pdf",
    "image/jpeg",
    "image/png",
]);

const ensureUploadDirectory = async () => {
    await fs.mkdir(PATIENT_UPLOAD_DIR, { recursive: true });
};

const isAllowedFile = (file) => {
    const extension = path.extname(file.originalname || "").toLowerCase();
    return ALLOWED_EXTENSIONS.has(extension) && ALLOWED_MIME_TYPES.has(file.mimetype);
};

const isFileSizeAllowed = (file) => Number(file.size || 0) <= MAX_FILE_SIZE_BYTES;

const sanitizeAttachment = (attachment) => ({
    id: attachment.id,
    patient_id: attachment.patient_id,
    uploaded_by: attachment.uploaded_by,
    file_name: attachment.file_name,
    file_type: attachment.file_type,
    file_size: attachment.file_size,
    description: attachment.description,
    created_at: attachment.created_at,
});

const getAttachmentById = async (attachmentId) => {
    if (!isPositiveInteger(attachmentId)) {
        return null;
    }

    const [rows] = await db.query(
        `SELECT id, patient_id, uploaded_by, file_name, file_type, file_size,
        file_url, description, created_at
        FROM attachments
        WHERE id = ?`,
        [attachmentId]
    );

    return rows.length > 0 ? rows[0] : null;
};

const getAttachmentPatientId = async (attachmentId) => {
    const attachment = await getAttachmentById(attachmentId);
    return attachment ? attachment.patient_id : null;
};

const createAttachment = async ({ req, file, patientId, description }) => {
    if (!isPositiveInteger(patientId)) {
        const error = new Error("Valid patient id is required");
        error.statusCode = 400;
        throw error;
    }

    if (!file) {
        const error = new Error("Attachment file is required");
        error.statusCode = 400;
        throw error;
    }

    const [patients] = await db.query("SELECT id FROM patients WHERE id = ?", [patientId]);

    if (patients.length === 0) {
        const error = new Error("Patient not found");
        error.statusCode = 404;
        throw error;
    }

    const [result] = await db.query(
        `INSERT INTO attachments
        (patient_id, uploaded_by, file_name, file_type, file_size, file_url, description)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
            patientId,
            getAuthenticatedUserId(req.user),
            file.originalname,
            file.mimetype,
            file.size,
            file.filename,
            description || null,
        ]
    );

    const attachment = await getAttachmentById(result.insertId);
    return sanitizeAttachment(attachment);
};

const listPatientAttachments = async (patientId) => {
    if (!isPositiveInteger(patientId)) {
        const error = new Error("Valid patient id is required");
        error.statusCode = 400;
        throw error;
    }

    const [rows] = await db.query(
        `SELECT id, patient_id, uploaded_by, file_name, file_type, file_size,
        description, created_at
        FROM attachments
        WHERE patient_id = ?
        ORDER BY created_at DESC`,
        [patientId]
    );

    return rows.map(sanitizeAttachment);
};

const getAttachmentForDownload = async (attachmentId) => {
    const attachment = await getAttachmentById(attachmentId);

    if (!attachment) {
        const error = new Error("Attachment not found");
        error.statusCode = 404;
        throw error;
    }

    const storedName = path.basename(attachment.file_url);

    return {
        attachment: sanitizeAttachment(attachment),
        absolutePath: path.join(PATIENT_UPLOAD_DIR, storedName),
    };
};

const deleteAttachment = async ({ req, attachmentId }) => {
    const attachment = await getAttachmentById(attachmentId);

    if (!attachment) {
        const error = new Error("Attachment not found");
        error.statusCode = 404;
        throw error;
    }

    const userId = getAuthenticatedUserId(req.user);

    if (!isAdmin(req.user) && Number(attachment.uploaded_by) !== Number(userId)) {
        const error = new Error("Not authorized to delete this attachment");
        error.statusCode = 403;
        error.resourceId = attachment.id;
        throw error;
    }

    await db.query("DELETE FROM attachments WHERE id = ?", [attachmentId]);

    const storedName = path.basename(attachment.file_url);
    const absolutePath = path.join(PATIENT_UPLOAD_DIR, storedName);

    try {
        await fs.unlink(absolutePath);
    } catch (error) {
        if (error.code !== "ENOENT") {
            console.error("Attachment file removal failed:", error.message);
        }
    }

    return sanitizeAttachment(attachment);
};

module.exports = {
    UPLOAD_ROOT,
    PATIENT_UPLOAD_DIR,
    MAX_FILE_SIZE_BYTES,
    ensureUploadDirectory,
    isAllowedFile,
    isFileSizeAllowed,
    getAttachmentPatientId,
    createAttachment,
    listPatientAttachments,
    getAttachmentForDownload,
    deleteAttachment,
};
