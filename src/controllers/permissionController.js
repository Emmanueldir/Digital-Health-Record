const permissionService = require("../services/permissionService");

exports.getPermissions = async (req, res, next) => {
    try {
        const permissions = await permissionService.listPermissions();
        return res.status(200).json(permissions);
    } catch (error) {
        return next(error);
    }
};

exports.createPermission = async (req, res, next) => {
    try {
        const permission = await permissionService.createPermission({
            req,
            name: req.body.name,
            description: req.body.description,
        });

        return res.status(201).json({
            success: true,
            message: "Permission created successfully",
            data: permission,
        });
    } catch (error) {
        return next(error);
    }
};
