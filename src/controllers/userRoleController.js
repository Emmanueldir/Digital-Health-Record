const userRoleService = require("../services/userRoleService");

exports.getUserRoles = async (req, res, next) => {
    try {
        const roles = await userRoleService.listUserRoles(Number(req.params.id));
        return res.status(200).json({
            success: true,
            message: "User roles retrieved successfully",
            data: roles,
        });
    } catch (error) {
        return next(error);
    }
};

exports.assignRole = async (req, res, next) => {
    try {
        const roles = await userRoleService.assignRoleToUser({
            req,
            userId: Number(req.params.id),
            roleId: Number(req.body.roleId),
        });

        return res.status(200).json({
            success: true,
            message: "Role assigned successfully",
            data: roles,
        });
    } catch (error) {
        return next(error);
    }
};

exports.removeRole = async (req, res, next) => {
    try {
        const roles = await userRoleService.removeRoleFromUser({
            req,
            userId: Number(req.params.id),
            roleId: Number(req.params.roleId),
        });

        return res.status(200).json({
            success: true,
            message: "Role removed successfully",
            data: roles,
        });
    } catch (error) {
        return next(error);
    }
};
