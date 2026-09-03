const crypto = require("crypto");
const path = require("path");

const express = require("express");
const multer = require("multer");
const router = express.Router();

const authenticateToken = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/rbacMiddleware");
const { authorizePermission } = require("../middleware/permissionMiddleware");
const { requireCareTeamAccess } = require("../middleware/accessMiddleware");
const { validateRequest } = require("../middleware/validationMiddleware");
const {
    PATIENT_UPLOAD_DIR,
    MAX_FILE_SIZE_BYTES,
    ensureUploadDirectory,
    isAllowedFile,
    getAttachmentPatientId,
} = require("../services/uploadService");
const {
    uploadAttachmentValidator,
    validateUploadedFile,
} = require("../validators/uploadValidators");
const uploadController = require("../controllers/uploadController");

const storage = multer.diskStorage({
    destination(req, file, callback) {
        ensureUploadDirectory()
            .then(() => callback(null, PATIENT_UPLOAD_DIR))
            .catch(callback);
    },
    filename(req, file, callback) {
        const extension = path.extname(file.originalname || "").toLowerCase();
        callback(null, `${Date.now()}-${crypto.randomUUID()}${extension}`);
    },
});

const multerUpload = multer({
    storage,
    limits: { fileSize: MAX_FILE_SIZE_BYTES },
    fileFilter(req, file, callback) {
        if (!isAllowedFile(file)) {
            const error = new Error("Only pdf, jpg, jpeg, and png files are allowed");
            error.statusCode = 400;
            return callback(error);
        }

        return callback(null, true);
    },
});

const handleAttachmentUpload = (req, res, next) => {
    multerUpload.single("file")(req, res, (error) => {
        if (!error) {
            return next();
        }

        if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({
                success: false,
                message: "File size must not exceed 10 MB",
            });
        }

        return res.status(error.statusCode || 400).json({
            success: false,
            message: error.message || "Invalid upload",
        });
    });
};

router.use(authenticateToken);

router.post(
    "/",
    authorizeRoles("doctor", "nurse", "admin", "lab_tech"),
    authorizePermission("upload_attachment"),
    handleAttachmentUpload,
    uploadAttachmentValidator,
    validateRequest,
    validateUploadedFile,
    requireCareTeamAccess("patient_id"),
    uploadController.uploadAttachment
);

router.get(
    "/patient/:id",
    authorizeRoles("doctor", "nurse", "admin", "lab_tech"),
    authorizePermission("view_attachment"),
    requireCareTeamAccess("id"),
    uploadController.getPatientAttachments
);

router.get(
    "/:id",
    authorizeRoles("doctor", "nurse", "admin", "lab_tech"),
    authorizePermission("download_attachment"),
    requireCareTeamAccess((req) => getAttachmentPatientId(req.params.id)),
    uploadController.downloadAttachment
);

router.delete(
    "/:id",
    authorizeRoles("doctor", "nurse", "admin", "lab_tech"),
    authorizePermission("delete_attachment"),
    uploadController.deleteAttachment
);

module.exports = router;
