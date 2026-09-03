const {
    createRequest,
    approveRequest,
    rejectRequest,
    listRequests,
    listUserRequests,
} = require("../services/breakGlassService");
const { getAuthenticatedUserId, isPositiveInteger } = require("../services/accessService");

const parsePagination = (query) => {
    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
    const offset = (page - 1) * limit;

    return { page, limit, offset };
};

exports.createBreakGlassRequest = async (req, res, next) => {
    try {
        const { patient_id, reason } = req.body;

        const id = await createRequest({
            req,
            patientId: patient_id,
            reason,
        });

        return res.status(201).json({
            success: true,
            message: "Break-glass request created successfully",
            data: { id },
        });
    } catch (error) {
        return next(error);
    }
};

exports.approveBreakGlassRequest = async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!isPositiveInteger(id)) {
            return res.status(400).json({ success: false, message: "Invalid request id" });
        }

        await approveRequest({ req, requestId: id });

        return res.status(200).json({
            success: true,
            message: "Break-glass request approved successfully",
            data: { id: Number(id) },
        });
    } catch (error) {
        return next(error);
    }
};

exports.rejectBreakGlassRequest = async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!isPositiveInteger(id)) {
            return res.status(400).json({ success: false, message: "Invalid request id" });
        }

        await rejectRequest({ req, requestId: id });

        return res.status(200).json({
            success: true,
            message: "Break-glass request rejected successfully",
            data: { id: Number(id) },
        });
    } catch (error) {
        return next(error);
    }
};

exports.getBreakGlassRequests = async (req, res, next) => {
    try {
        const { page, limit, offset } = parsePagination(req.query);
        const requests = await listRequests({ limit, offset });

        return res.status(200).json({
            success: true,
            message: "Break-glass requests retrieved successfully",
            data: { page, limit, requests },
        });
    } catch (error) {
        return next(error);
    }
};

exports.getMyBreakGlassRequests = async (req, res, next) => {
    try {
        const { page, limit, offset } = parsePagination(req.query);
        const requests = await listUserRequests({
            userId: getAuthenticatedUserId(req.user),
            limit,
            offset,
        });

        return res.status(200).json({
            success: true,
            message: "My break-glass requests retrieved successfully",
            data: { page, limit, requests },
        });
    } catch (error) {
        return next(error);
    }
};
