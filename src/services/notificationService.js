const db = require("../config/db");
const { writeAuditLog } = require("../middleware/auditMiddleware");
const { sendEmail } = require("./emailService");
const { getAuthenticatedUserId } = require("./accessService");

const sendNotification = async ({
    req,
    to,
    subject,
    text,
    resourceType = "email",
    resourceId = null,
}) => {
    try {
        if (!to) {
            throw new Error("Notification recipient email is missing");
        }

        const delivery = await sendEmail({ to, subject, text });

        if (delivery.skipped) {
            await writeAuditLog({
                req,
                action: "EMAIL_SKIPPED",
                resourceType,
                resourceId,
                status: "success",
            });

            return { sent: false, skipped: true };
        }

        await writeAuditLog({
            req,
            action: "EMAIL_SENT",
            resourceType,
            resourceId,
            status: "success",
        });

        return { sent: true };
    } catch (error) {
        console.error("Email notification failed:", error.message);

        await writeAuditLog({
            req,
            action: "EMAIL_FAILED",
            resourceType,
            resourceId,
            status: "denied",
        });

        return { sent: false, error: error.message };
    }
};

const getUserEmail = async (userId) => {
    const [rows] = await db.query("SELECT email FROM users WHERE id = ?", [userId]);
    return rows.length > 0 ? rows[0].email : null;
};

const getPrimaryDoctor = async (patientId) => {
    const [rows] = await db.query(
        `SELECT u.id, u.email
        FROM patient_care_team pct
        INNER JOIN users u ON u.id = pct.user_id
        WHERE pct.patient_id = ?
        AND pct.is_active = TRUE
        AND LOWER(REPLACE(pct.role, ' ', '_')) = 'primary_doctor'
        ORDER BY pct.created_at ASC
        LIMIT 1`,
        [patientId]
    );

    return rows.length > 0 ? rows[0] : null;
};

const notifyCareTeamAssignment = async ({ req, userId, careTeamId }) => {
    try {
        const email = await getUserEmail(userId);

        return sendNotification({
            req,
            to: email,
            subject: "Care Team Assignment",
            text: "You have been assigned to a patient's care team.",
            resourceType: "care_team",
            resourceId: careTeamId,
        });
    } catch (error) {
        return sendNotification({
            req,
            to: null,
            subject: "Care Team Assignment",
            text: "You have been assigned to a patient's care team.",
            resourceType: "care_team",
            resourceId: careTeamId,
        });
    }
};

const getBreakGlassRequester = async (requestId) => {
    const [rows] = await db.query(
        "SELECT requested_by FROM break_glass_requests WHERE id = ?",
        [requestId]
    );

    return rows.length > 0 ? rows[0].requested_by : null;
};

const notifyBreakGlassDecision = async ({ req, requestedBy, requestId, approved }) => {
    try {
        const requesterId = requestedBy || (await getBreakGlassRequester(requestId));
        const email = await getUserEmail(requesterId);

        return sendNotification({
            req,
            to: email,
            subject: approved ? "Break Glass Request Approved" : "Break Glass Request Rejected",
            text: approved
                ? "Your emergency access request has been approved."
                : "Your emergency access request has been rejected.",
            resourceType: "break_glass",
            resourceId: requestId,
        });
    } catch (error) {
        return sendNotification({
            req,
            to: null,
            subject: approved ? "Break Glass Request Approved" : "Break Glass Request Rejected",
            text: approved
                ? "Your emergency access request has been approved."
                : "Your emergency access request has been rejected.",
            resourceType: "break_glass",
            resourceId: requestId,
        });
    }
};

const notifyPrimaryDoctorOfLabResult = async ({ req, patientId, labResultId }) => {
    try {
        const primaryDoctor = await getPrimaryDoctor(patientId);

        return sendNotification({
            req,
            to: primaryDoctor && primaryDoctor.email,
            subject: "New Lab Result Created",
            text: "A new lab result has been created for a patient under your care.",
            resourceType: "lab_result",
            resourceId: labResultId,
        });
    } catch (error) {
        return sendNotification({
            req,
            to: null,
            subject: "New Lab Result Created",
            text: "A new lab result has been created for a patient under your care.",
            resourceType: "lab_result",
            resourceId: labResultId,
        });
    }
};

const notifyPrimaryDoctorOfMedicalRecord = async ({ req, patientId, recordId }) => {
    try {
        const primaryDoctor = await getPrimaryDoctor(patientId);
        const currentUserId = getAuthenticatedUserId(req.user);

        if (primaryDoctor && Number(primaryDoctor.id) === Number(currentUserId)) {
            return { sent: false, skipped: true };
        }

        return sendNotification({
            req,
            to: primaryDoctor && primaryDoctor.email,
            subject: "New Medical Record Created",
            text: "A new medical record has been created for a patient under your care.",
            resourceType: "medical_record",
            resourceId: recordId,
        });
    } catch (error) {
        return sendNotification({
            req,
            to: null,
            subject: "New Medical Record Created",
            text: "A new medical record has been created for a patient under your care.",
            resourceType: "medical_record",
            resourceId: recordId,
        });
    }
};

module.exports = {
    sendNotification,
    notifyCareTeamAssignment,
    notifyBreakGlassDecision,
    notifyPrimaryDoctorOfLabResult,
    notifyPrimaryDoctorOfMedicalRecord,
};
