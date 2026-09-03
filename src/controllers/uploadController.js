const fs = require("fs/promises");

const {
    createAttachment,
    listPatientAttachments,
    getAttachmentForDownload,
    deleteAttachment,
} = require("../services/uploadService");
const { writeAuditLog } = require("../middleware/auditMiddleware");

const cleanupUploadedFile = async (file) => {
    if (!file || !file.path) {
        return;
    }

    try {
        await fs.unlink(file.path);
    } catch (error) {
        if (error.code !== "ENOENT") {
            console.error("Uploaded file cleanup failed:", error.message);
        }
    }
};

exports.uploadAttachment = async (req, res, next) => {
    try {
        const attachment = await createAttachment({
            req,
            file: req.file,
            patientId: req.body.patient_id,
            description: req.body.description,
        });

        await writeAuditLog({
            req,
            action: "ATTACHMENT_UPLOADED",
            resourceType: "attachment",
            resourceId: attachment.id,
            status: "success",
        });

        return res.status(201).json({
            success: true,
            message: "Attachment uploaded successfully",
            data: attachment,
        });
    } catch (error) {
        await cleanupUploadedFile(req.file);
        return next(error);
    }
};

exports.getPatientAttachments = async (req, res, next) => {
    try {
        const attachments = await listPatientAttachments(req.params.id);

        await writeAuditLog({
            req,
            action: "ATTACHMENT_VIEWED",
            resourceType: "attachment",
            resourceId: req.params.id,
            status: "success",
        });

        return res.status(200).json({
            success: true,
            message: "Attachments retrieved successfully",
            data: attachments,
        });
    } catch (error) {
        return next(error);
    }
};

exports.downloadAttachment = async (req, res, next) => {
    try {
        const { attachment, absolutePath } = await getAttachmentForDownload(req.params.id);

        await writeAuditLog({
            req,
            action: "ATTACHMENT_DOWNLOADED",
            resourceType: "attachment",
            resourceId: attachment.id,
            status: "success",
        });

        return res.download(absolutePath, attachment.file_name, (error) => {
            if (error && !res.headersSent) {
                return next(error);
            }

            return undefined;
        });
    } catch (error) {
        return next(error);
    }
};

exports.deleteAttachment = async (req, res, next) => {
    try {
        const attachment = await deleteAttachment({
            req,
            attachmentId: req.params.id,
        });

        await writeAuditLog({
            req,
            action: "ATTACHMENT_DELETED",
            resourceType: "attachment",
            resourceId: attachment.id,
            status: "success",
        });

        return res.status(200).json({
            success: true,
            message: "Attachment deleted successfully",
            data: { id: attachment.id },
        });
    } catch (error) {
        if (error.statusCode === 403) {
            await writeAuditLog({
                req,
                action: "authorization_denied",
                resourceType: "attachment",
                resourceId: error.resourceId || req.params.id,
                status: "denied",
            });
        }

        return next(error);
    }
};
