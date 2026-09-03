const roleService = require("../services/roleService");

exports.getRoles = async (req, res, next) => {
    try {
        const roles = await roleService.listRoles();
        return res.status(200).json(roles);
    } catch (error) {
        return next(error);
    }
};

exports.createRole = async (req, res, next) => {
    try {
        const role = await roleService.createRole({
            req,
            name: req.body.name,
            description: req.body.description,
        });

        return res.status(201).json({
            success: true,
            message: "Role created successfully",
            data: role,
        });
    } catch (error) {
        return next(error);
    }
};

exports.updateRole = async (req, res, next) => {
    try {
        const role = await roleService.updateRole({
            req,
            roleId: Number(req.params.id),
            name: req.body.name,
            description: req.body.description,
        });

        return res.status(200).json({
            success: true,
            message: "Role updated successfully",
            data: role,
        });
    } catch (error) {
        return next(error);
    }
};

exports.deleteRole = async (req, res, next) => {
    try {
        const role = await roleService.deleteRole({
            req,
            roleId: Number(req.params.id),
        });

        return res.status(200).json({
            success: true,
            message: "Role deleted successfully",
            data: role,
        });
    } catch (error) {
        return next(error);
    }
};

exports.getRolePermissions = async (req, res, next) => {
    try {
        const permissions = await roleService.listRolePermissions(Number(req.params.roleId));
        return res.status(200).json({
            success: true,
            message: "Role permissions retrieved successfully",
            data: permissions,
        });
    } catch (error) {
        return next(error);
    }
};

exports.assignPermission = async (req, res, next) => {
    try {
        const permissions = await roleService.assignPermissionToRole({
            req,
            roleId: Number(req.params.roleId),
            permissionId: Number(req.body.permissionId),
        });

        return res.status(200).json({
            success: true,
            message: "Permission assigned to role successfully",
            data: permissions,
        });
    } catch (error) {
        return next(error);
    }
};

exports.removePermission = async (req, res, next) => {
    try {
        const permissions = await roleService.removePermissionFromRole({
            req,
            roleId: Number(req.params.roleId),
            permissionId: Number(req.params.permissionId),
        });

        return res.status(200).json({
            success: true,
            message: "Permission removed from role successfully",
            data: permissions,
        });
    } catch (error) {
        return next(error);
    }
};
