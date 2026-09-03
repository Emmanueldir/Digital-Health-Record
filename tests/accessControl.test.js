const assert = require("assert");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const db = require("../src/config/db");
const authController = require("../src/controllers/authController");
const authenticateToken = require("../src/middleware/authMiddleware");
const { authorizeRoles } = require("../src/middleware/rbacMiddleware");
const { authorizePermission } = require("../src/middleware/permissionMiddleware");
const { requireCareTeamAccess } = require("../src/middleware/accessMiddleware");
const { validateRequest } = require("../src/middleware/validationMiddleware");
const { registerValidator } = require("../src/validators/authValidators");

const originalQuery = db.query;

const createResponse = () => {
    const response = {
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
    };

    return response;
};

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

const runMiddlewareStack = async (middlewares, req) => {
    const res = createResponse();
    let index = 0;

    const next = async (error) => {
        if (error) {
            throw error;
        }

        const middleware = middlewares[index];
        index += 1;

        if (middleware) {
            await middleware(req, res, next);
        }
    };

    await next();

    return { nextCalled: !res.body, res };
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

const testRegistrationAssignsPatientRole = async () => {
    await withMockedQueries(
        async (sql) => {
            if (sql.includes("SELECT * FROM users")) {
                return [[]];
            }

            if (sql.includes("INSERT INTO users")) {
                return [{ insertId: 42 }];
            }

            if (sql.includes("SELECT id FROM roles")) {
                return [[{ id: 5 }]];
            }

            if (sql.includes("INSERT INTO user_roles")) {
                return [{ affectedRows: 1 }];
            }

            throw new Error(`Unexpected query: ${sql}`);
        },
        async (calls) => {
            const req = {
                body: {
                    username: "patient001",
                    email: "patient@example.com",
                    password: "password123",
                    phone: "08000000000",
                },
            };
            const res = createResponse();

            await authController.register(req, res);

            assert.strictEqual(res.statusCode, 201);
            assert.strictEqual(res.body.userId, 42);
            assert.ok(calls.some((call) => call.sql.includes("INSERT INTO user_roles")));
            assert.deepStrictEqual(
                calls.find((call) => call.sql.includes("INSERT INTO user_roles")).params,
                [42, 5]
            );
        }
    );
};

const testAuthMiddlewareValidatesJwt = async () => {
    const token = jwt.sign({ sub: "7", email: "user@example.com", role: "Doctor" }, process.env.JWT_SECRET);
    const result = await runMiddleware(authenticateToken, {
        headers: { authorization: `Bearer ${token}` },
    });

    assert.strictEqual(result.nextCalled, true);
};

const testAuthMiddlewareRejectsMalformedToken = async () => {
    await withMockedQueries(
        async () => [{ affectedRows: 1 }],
        async () => {
            const result = await runMiddleware(authenticateToken, {
                headers: { authorization: "bad-token" },
            });

            assert.strictEqual(result.nextCalled, false);
            assert.strictEqual(result.res.statusCode, 401);
        }
    );
};

const testRbacAllowsAndDeniesRoles = async () => {
    const allowed = await runMiddleware(authorizeRoles("doctor"), {
        user: { role: "Doctor" },
    });

    assert.strictEqual(allowed.nextCalled, true);

    await withMockedQueries(
        async () => [{ affectedRows: 1 }],
        async () => {
            const denied = await runMiddleware(authorizeRoles("doctor"), {
                user: { role: "Nurse" },
            });

            assert.strictEqual(denied.nextCalled, false);
            assert.strictEqual(denied.res.statusCode, 403);
        }
    );
};

const testPermissionMiddleware = async () => {
    await withMockedQueries(
        async (sql) => {
            if (sql.includes("SELECT p.id")) {
                return [[{ id: 1 }]];
            }

            return [{ affectedRows: 1 }];
        },
        async () => {
            const allowed = await runMiddleware(authorizePermission("view_patient"), {
                user: { sub: "3", role: "Doctor" },
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
            const denied = await runMiddleware(authorizePermission("view_audit_logs"), {
                user: { sub: "3", role: "Doctor" },
            });

            assert.strictEqual(denied.nextCalled, false);
            assert.strictEqual(denied.res.statusCode, 403);
        }
    );
};

const testCareTeamAccess = async () => {
    await withMockedQueries(
        async () => [[{ id: 1 }]],
        async () => {
            const allowed = await runMiddleware(requireCareTeamAccess("id"), {
                params: { id: "10" },
                body: {},
                user: { sub: "3", role: "Doctor" },
            });

            assert.strictEqual(allowed.nextCalled, true);
        }
    );

    await withMockedQueries(
        async (sql) => {
            if (sql.includes("FROM patient_care_team")) {
                return [[]];
            }

            if (sql.includes("FROM break_glass_requests")) {
                return [[]];
            }

            return [{ affectedRows: 1 }];
        },
        async () => {
            const denied = await runMiddleware(requireCareTeamAccess("id"), {
                params: { id: "10" },
                body: {},
                user: { sub: "3", role: "Doctor" },
            });

            assert.strictEqual(denied.nextCalled, false);
            assert.strictEqual(denied.res.statusCode, 403);
        }
    );
};

const testRegistrationValidation = async () => {
    const req = {
        body: {
            username: "ab",
            email: "bad-email",
            password: "short",
        },
    };

    await Promise.all(registerValidator.map((validator) => validator.run(req)));

    const result = await runMiddleware(validateRequest, req);

    assert.strictEqual(result.nextCalled, false);
    assert.strictEqual(result.res.statusCode, 422);
    assert.strictEqual(result.res.body.success, false);
    assert.ok(result.res.body.errors.some((error) => error.field === "username"));
    assert.ok(result.res.body.errors.some((error) => error.field === "email"));
    assert.ok(result.res.body.errors.some((error) => error.field === "password"));
};

const runAccessControlTests = async () => {
    await testRegistrationAssignsPatientRole();
    await testAuthMiddlewareValidatesJwt();
    await testAuthMiddlewareRejectsMalformedToken();
    await testRbacAllowsAndDeniesRoles();
    await testPermissionMiddleware();
    await testCareTeamAccess();
    await testRegistrationValidation();

    console.log("access control tests passed");
};

if (require.main === module) {
    runAccessControlTests().catch((error) => {
        db.query = originalQuery;
        console.error(error);
        process.exit(1);
    });
}

module.exports = runAccessControlTests;
