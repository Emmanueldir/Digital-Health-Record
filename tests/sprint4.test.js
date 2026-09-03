const assert = require("assert");
const bcrypt = require("bcrypt");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
delete process.env.EMAIL_HOST;
delete process.env.EMAIL_PORT;
delete process.env.EMAIL_USER;
delete process.env.EMAIL_PASS;
delete process.env.EMAIL_FROM;

const db = require("../src/config/db");
const authController = require("../src/controllers/authController");
const {
    createRequest,
    approveRequest,
    rejectRequest,
    findActiveApprovedAccess,
} = require("../src/services/breakGlassService");
const { hasPatientAccess } = require("../src/services/accessService");

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

const roleRows = (role) => [[{
    role_id: 1,
    role,
    permission: "view_patient",
}]];

const testStaffLoginRequiresOtp = async () => {
    const passwordHash = await bcrypt.hash("password123", 4);

    await withMockedQueries(
        async (sql, params) => {
            if (sql.includes("SELECT id, email, password_hash, status FROM users")) {
                return [[{ id: 9, email: "doctor@example.com", password_hash: passwordHash, status: "active" }]];
            }

            if (sql.includes("FROM user_roles")) {
                return roleRows("Doctor");
            }

            if (sql.includes("UPDATE otp_verifications")) {
                return [{ affectedRows: 1 }];
            }

            if (sql.includes("INSERT INTO otp_verifications")) {
                return [{ insertId: 22 }];
            }

            if (sql.includes("INSERT INTO audit_logs")) {
                return [{ insertId: 1 }];
            }

            throw new Error(`Unexpected query: ${sql}`);
        },
        async (calls) => {
            const req = {
                body: { email: "doctor@example.com", password: "password123", role: "Doctor" },
            };
            const res = createResponse();

            await authController.login(req, res);

            assert.strictEqual(res.statusCode, 200);
            assert.strictEqual(res.body.requiresOtp, true);
            assert.strictEqual(res.body.accessToken, undefined);
            assert.ok(calls.some((call) => call.sql.includes("INSERT INTO otp_verifications")));
        }
    );
};

const testPatientLoginBypassesOtp = async () => {
    const passwordHash = await bcrypt.hash("password123", 4);

    await withMockedQueries(
        async (sql, params) => {
            if (sql.includes("SELECT id, email, password_hash, status FROM users")) {
                return [[{ id: 10, email: "patient@example.com", password_hash: passwordHash, status: "active" }]];
            }

            if (sql.includes("FROM user_roles")) {
                return roleRows("Patient");
            }

            if (sql.includes("UPDATE users SET last_login")) {
                return [{ affectedRows: 1 }];
            }

            if (sql.includes("INSERT INTO audit_logs")) {
                return [{ insertId: 1 }];
            }

            throw new Error(`Unexpected query: ${sql}`);
        },
        async () => {
            const req = {
                body: { email: "patient@example.com", password: "password123", role: "Patient" },
            };
            const res = createResponse();

            await authController.login(req, res);

            assert.strictEqual(res.statusCode, 200);
            assert.strictEqual(res.body.requiresOtp, undefined);
            assert.ok(res.body.accessToken);
        }
    );
};

const testOtpVerificationIssuesJwtAndPreventsReuse = async () => {
    await withMockedQueries(
        async (sql, params) => {
            if (sql.includes("SELECT id, email, status FROM users")) {
                return [[{ id: 9, email: "doctor@example.com", status: "active" }]];
            }

            if (sql.includes("FROM otp_verifications") && sql.includes("otp_code")) {
                return [[{ id: 44, role: "Doctor", expires_at: new Date(Date.now() + 600000) }]];
            }

            if (sql.includes("FROM user_roles")) {
                return roleRows("Doctor");
            }

            if (sql.includes("UPDATE otp_verifications SET is_used")) {
                return [{ affectedRows: 1 }];
            }

            if (sql.includes("UPDATE users SET last_login")) {
                return [{ affectedRows: 1 }];
            }

            if (sql.includes("INSERT INTO audit_logs")) {
                return [{ insertId: 1 }];
            }

            throw new Error(`Unexpected query: ${sql}`);
        },
        async (calls) => {
            const req = {
                body: { email: "doctor@example.com", otp: "123456" },
            };
            const res = createResponse();

            await authController.verifyOtp(req, res);

            assert.strictEqual(res.statusCode, 200);
            assert.ok(res.body.accessToken);
            assert.ok(calls.some((call) => call.sql.includes("UPDATE otp_verifications SET is_used")));
        }
    );
};

const testExpiredOtpFails = async () => {
    await withMockedQueries(
        async (sql) => {
            if (sql.includes("SELECT id, email, status FROM users")) {
                return [[{ id: 9, email: "doctor@example.com", status: "active" }]];
            }

            if (sql.includes("FROM otp_verifications") && sql.includes("otp_code")) {
                return [[{ id: 44, role: "Doctor", expires_at: new Date(Date.now() - 1000) }]];
            }

            if (sql.includes("UPDATE otp_verifications SET is_used")) {
                return [{ affectedRows: 1 }];
            }

            if (sql.includes("INSERT INTO audit_logs")) {
                return [{ insertId: 1 }];
            }

            throw new Error(`Unexpected query: ${sql}`);
        },
        async () => {
            const req = {
                body: { email: "doctor@example.com", otp: "123456" },
            };
            const res = createResponse();

            await authController.verifyOtp(req, res);

            assert.strictEqual(res.statusCode, 401);
            assert.strictEqual(res.body.success, false);
        }
    );
};

const testBreakGlassLifecycle = async () => {
    await withMockedQueries(
        async (sql, params) => {
            if (sql.includes("SELECT id FROM patients")) {
                return [[{ id: 5 }]];
            }

            if (sql.includes("INSERT INTO break_glass_requests")) {
                return [{ insertId: 99 }];
            }

            if (sql.includes("UPDATE break_glass_requests") && params[0] === "APPROVED") {
                return [{ affectedRows: 1 }];
            }

            if (sql.includes("UPDATE break_glass_requests") && params[0] === "REJECTED") {
                return [{ affectedRows: 1 }];
            }

            if (sql.includes("INSERT INTO audit_logs")) {
                return [{ insertId: 1 }];
            }

            throw new Error(`Unexpected query: ${sql}`);
        },
        async () => {
            const req = {
                user: { sub: "7", role: "Doctor" },
                body: {},
            };

            const requestId = await createRequest({
                req,
                patientId: 5,
                reason: "Emergency trauma treatment",
            });

            assert.strictEqual(requestId, 99);

            await approveRequest({
                req: { user: { sub: "1", role: "Admin" } },
                requestId: 99,
            });

            await rejectRequest({
                req: { user: { sub: "1", role: "Admin" } },
                requestId: 99,
            });
        }
    );
};

const testBreakGlassAccessAuthorization = async () => {
    await withMockedQueries(
        async (sql) => {
            if (sql.includes("FROM patient_care_team")) {
                return [[]];
            }

            if (sql.includes("FROM break_glass_requests")) {
                return [[{ id: 77, expires_at: new Date(Date.now() + 600000) }]];
            }

            if (sql.includes("INSERT INTO audit_logs")) {
                return [{ insertId: 1 }];
            }

            throw new Error(`Unexpected query: ${sql}`);
        },
        async () => {
            const access = await hasPatientAccess({
                req: { user: { sub: "7", role: "Doctor" } },
                user: { sub: "7", role: "Doctor" },
                patientId: 5,
            });

            assert.strictEqual(access, true);
        }
    );
};

const runSprint4Tests = async () => {
    await testStaffLoginRequiresOtp();
    await testPatientLoginBypassesOtp();
    await testOtpVerificationIssuesJwtAndPreventsReuse();
    await testExpiredOtpFails();
    await testBreakGlassLifecycle();
    await testBreakGlassAccessAuthorization();

    console.log("sprint 4 tests passed");
};

if (require.main === module) {
    runSprint4Tests().catch((error) => {
        db.query = originalQuery;
        console.error(error);
        process.exit(1);
    });
}

module.exports = runSprint4Tests;
