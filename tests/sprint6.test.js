const assert = require("assert");

const db = require("../src/config/db");
const roleService = require("../src/services/roleService");
const permissionService = require("../src/services/permissionService");
const userRoleService = require("../src/services/userRoleService");
const { authorizePermission } = require("../src/middleware/permissionMiddleware");
const { validateRequest } = require("../src/middleware/validationMiddleware");
const { createRoleValidator } = require("../src/validators/roleValidators");
const { createPermissionValidator } = require("../src/validators/permissionValidators");
const { assignUserRoleValidator } = require("../src/validators/userRoleValidators");

const originalQuery = db.query;

const createResponse = () => ({
    statusCode: 200,
    body: null,
    status(code) {
        this.statusCode = code;
        return this;
    },
    json(payload) {
        this.body = payload;
        return this;
    },
});

const runMiddleware = (middleware, req) =>
    new Promise((resolve, reject) => {
        const res = createResponse();
        const next = (error) => {
            if (error) {
                reject(error);
                return;
            }

            resolve({ nextCalled: true, res });
        };

        Promise.resolve(middleware(req, res, next))
            .then(() => {
                if (res.body) {
                    resolve({ nextCalled: false, res });
                }
            })
            .catch(reject);
    });

const runValidators = async (validators, req) => {
    for (const validator of validators) {
        await validator.run(req);
    }

    return runMiddleware(validateRequest, req);
};

const withMockedQueries = async (handler, assertions) => {
    const calls = [];

    db.query = async (sql, params) => {
        calls.push({ sql, params });
        return handler(sql, params, calls.length);
    };

    try {
        await assertions(calls);
    } finally {
        db.query = originalQuery;
    }
};

const testRoleCreationUpdateAndDeletion = async () => {
    await withMockedQueries(
        async (sql) => {
            if (sql.includes("INSERT INTO roles")) {
                return [{ insertId: 10 }];
            }

            if (sql.includes("SELECT id, name, description FROM roles WHERE id")) {
                return [[{ id: 10, name: "Receptionist", description: "Handles front desk" }]];
            }

            if (sql.includes("UPDATE roles SET")) {
                return [{ affectedRows: 1 }];
            }

            if (sql.includes("DELETE FROM roles")) {
                return [{ affectedRows: 1 }];
            }

            if (sql.includes("INSERT INTO audit_logs")) {
                return [{ insertId: 1 }];
            }

            throw new Error(`Unexpected query: ${sql}`);
        },
        async (calls) => {
            const req = { user: { sub: "1", role: "Admin" } };

            const created = await roleService.createRole({
                req,
                name: "Receptionist",
                description: "Handles front desk",
            });
            assert.strictEqual(created.id, 10);

            const updated = await roleService.updateRole({
                req,
                roleId: 10,
                name: "Reception Lead",
                description: "Desk lead",
            });
            assert.strictEqual(updated.id, 10);

            const deleted = await roleService.deleteRole({ req, roleId: 10 });
            assert.strictEqual(deleted.name, "Receptionist");
            assert.ok(calls.some((call) => call.params.includes("ROLE_CREATED")));
            assert.ok(calls.some((call) => call.params.includes("ROLE_UPDATED")));
            assert.ok(calls.some((call) => call.params.includes("ROLE_DELETED")));
        }
    );
};

const testProtectedRoleDeletionIsPrevented = async () => {
    await withMockedQueries(
        async (sql) => {
            if (sql.includes("SELECT id, name, description FROM roles WHERE id")) {
                return [[{ id: 1, name: "Admin", description: "System administrator" }]];
            }

            throw new Error(`Unexpected query: ${sql}`);
        },
        async () => {
            await assert.rejects(
                () => roleService.deleteRole({ req: { user: { sub: "1", role: "Admin" } }, roleId: 1 }),
                (error) => error.statusCode === 400 && error.message.includes("Protected")
            );
        }
    );
};

const testPermissionCreation = async () => {
    await withMockedQueries(
        async (sql) => {
            if (sql.includes("INSERT INTO permissions")) {
                return [{ insertId: 12 }];
            }

            if (sql.includes("SELECT id, name, description FROM permissions WHERE id")) {
                return [[{ id: 12, name: "view_reports", description: null }]];
            }

            if (sql.includes("INSERT INTO audit_logs")) {
                return [{ insertId: 1 }];
            }

            throw new Error(`Unexpected query: ${sql}`);
        },
        async (calls) => {
            const permission = await permissionService.createPermission({
                req: { user: { sub: "1", role: "Admin" } },
                name: "view_reports",
            });

            assert.strictEqual(permission.id, 12);
            assert.ok(calls.some((call) => call.params.includes("PERMISSION_CREATED")));
        }
    );
};

const testRolePermissionAssignmentAndRemoval = async () => {
    await withMockedQueries(
        async (sql) => {
            if (sql.includes("INSERT IGNORE INTO role_permissions")) {
                return [{ affectedRows: 1 }];
            }

            if (sql.includes("DELETE FROM role_permissions")) {
                return [{ affectedRows: 1 }];
            }

            if (sql.includes("FROM permissions p")) {
                return [[{ id: 5, name: "view_reports", description: null }]];
            }

            if (sql.includes("INSERT INTO audit_logs")) {
                return [{ insertId: 1 }];
            }

            throw new Error(`Unexpected query: ${sql}`);
        },
        async (calls) => {
            const req = { user: { sub: "1", role: "Admin" } };

            const assigned = await roleService.assignPermissionToRole({
                req,
                roleId: 2,
                permissionId: 5,
            });
            assert.strictEqual(assigned.length, 1);

            const removed = await roleService.removePermissionFromRole({
                req,
                roleId: 2,
                permissionId: 5,
            });
            assert.strictEqual(removed.length, 1);
            assert.ok(calls.some((call) => call.params.includes("ROLE_PERMISSION_ASSIGNED")));
            assert.ok(calls.some((call) => call.params.includes("ROLE_PERMISSION_REMOVED")));
        }
    );
};

const testUserRoleAssignmentAndRemoval = async () => {
    await withMockedQueries(
        async (sql) => {
            if (sql.includes("INSERT IGNORE INTO user_roles")) {
                return [{ affectedRows: 1 }];
            }

            if (sql.includes("DELETE FROM user_roles")) {
                return [{ affectedRows: 1 }];
            }

            if (sql.includes("FROM roles r")) {
                return [[{ id: 2, name: "Doctor", description: "Medical doctor" }]];
            }

            if (sql.includes("INSERT INTO audit_logs")) {
                return [{ insertId: 1 }];
            }

            throw new Error(`Unexpected query: ${sql}`);
        },
        async (calls) => {
            const req = { user: { sub: "1", role: "Admin" } };

            const assigned = await userRoleService.assignRoleToUser({ req, userId: 7, roleId: 2 });
            assert.strictEqual(assigned[0].name, "Doctor");

            const removed = await userRoleService.removeRoleFromUser({ req, userId: 7, roleId: 2 });
            assert.strictEqual(removed[0].name, "Doctor");
            assert.ok(calls.some((call) => call.params.includes("ROLE_ASSIGNED")));
            assert.ok(calls.some((call) => call.params.includes("ROLE_REMOVED")));
        }
    );
};

const testManagePermissionEnforcement = async () => {
    for (const permission of ["manage_roles", "manage_permissions", "manage_users"]) {
        await withMockedQueries(
            async (sql) => {
                if (sql.includes("SELECT p.id")) {
                    return [[{ id: 1 }]];
                }

                return [{ affectedRows: 1 }];
            },
            async () => {
                const allowed = await runMiddleware(authorizePermission(permission), {
                    user: { sub: "9", role: "Doctor" },
                });

                assert.strictEqual(allowed.nextCalled, true);
            }
        );

        await withMockedQueries(
            async (sql) => {
                if (sql.includes("SELECT p.id")) {
                    return [[]];
                }

                return [{ affectedRows: 1 }];
            },
            async () => {
                const denied = await runMiddleware(authorizePermission(permission), {
                    user: { sub: "9", role: "Doctor" },
                });

                assert.strictEqual(denied.nextCalled, false);
                assert.strictEqual(denied.res.statusCode, 403);
            }
        );
    }
};

const testValidationFailures = async () => {
    await withMockedQueries(
        async (sql) => {
            if (sql.includes("SELECT id FROM roles WHERE LOWER(name)")) {
                return [[{ id: 1 }]];
            }

            throw new Error(`Unexpected query: ${sql}`);
        },
        async () => {
            const result = await runValidators(createRoleValidator, {
                body: { name: "Doctor" },
                params: {},
            });

            assert.strictEqual(result.nextCalled, false);
            assert.strictEqual(result.res.statusCode, 422);
            assert.ok(result.res.body.errors.some((error) => error.message.includes("unique")));
        }
    );

    const missingPermission = await runValidators(createPermissionValidator, {
        body: { name: "" },
        params: {},
    });
    assert.strictEqual(missingPermission.nextCalled, false);
    assert.strictEqual(missingPermission.res.statusCode, 422);

    await withMockedQueries(
        async (sql) => {
            if (sql.includes("SELECT id FROM users WHERE id")) {
                return [[]];
            }

            if (sql.includes("SELECT id FROM roles WHERE id")) {
                return [[{ id: 2 }]];
            }

            throw new Error(`Unexpected query: ${sql}`);
        },
        async () => {
            const invalidUser = await runValidators(assignUserRoleValidator, {
                params: { id: "999" },
                body: { roleId: 2 },
            });

            assert.strictEqual(invalidUser.nextCalled, false);
            assert.strictEqual(invalidUser.res.statusCode, 422);
        }
    );
};

const runSprint6Tests = async () => {
    await testRoleCreationUpdateAndDeletion();
    await testProtectedRoleDeletionIsPrevented();
    await testPermissionCreation();
    await testRolePermissionAssignmentAndRemoval();
    await testUserRoleAssignmentAndRemoval();
    await testManagePermissionEnforcement();
    await testValidationFailures();

    console.log("sprint 6 tests passed");
};

if (require.main === module) {
    runSprint6Tests().catch((error) => {
        db.query = originalQuery;
        console.error(error);
        process.exit(1);
    });
}

module.exports = runSprint6Tests;
