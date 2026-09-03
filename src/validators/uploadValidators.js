const { body } = require("express-validator");

const uploadAttachmentValidator = [
    body("patient_id").isInt({ min: 1 }).withMessage("patient_id must be a positive integer"),
    body("description").optional().trim().isLength({ max: 500 }).withMessage("description must be 500 characters or fewer"),
];

const validateUploadedFile = (req, res, next) => {
    if (!req.file) {
        return res.status(400).json({
            success: false,
            message: "Attachment file is required",
        });
    }

    return next();
};

module.exports = {
    uploadAttachmentValidator,
    validateUploadedFile,
};
