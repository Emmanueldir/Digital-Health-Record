const assert = require("assert");

const db = require("../src/config/db");
const careTeamController = require("../src/controllers/careTeamController");
const { validateRequest } = require("../src/middleware/validationMiddleware");
const {
    assignCareTeamMemberValidator,
    patientCareTeamValidator,
    deactivateCareTeamMemberValidator,
} = require("../src/validators/careTeamValidators");

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

const testViewPatientCareTeam = async () => {
    await withMockedQueries(
        async (sql) => {
            if (sql.includes("FROM patient_care_team pct") && sql.includes("GROUP_CONCAT")) {
                return [[{
                    id: 12,
                    patient_id: 5,
                    user_id: 7,
                    staff_name: "doctor001",
                    staff_email: "doctor@example.com",
                    staff_role: "Doctor",
                    assignment_role: "PRIMARY_DOCTOR",
                    is_active: 1,
                    created_at: new Date(),
                }]];
            }

            if (sql.includes("INSERT INTO audit_logs")) {
                return [{ insertId: 1 }];
            }

            throw new Error(`Unexpected query: ${sql}`);
        },
        async (calls) => {
            const req = { params: { id: "5" }, user: { sub: "1", role: "Admin" } };
            const res = createResponse();

            await careTeamController.getPatientCareTeam(req, res, (error) => {
                throw error;
            });

            assert.strictEqual(res.statusCode, 200);
            assert.strictEqual(res.body.data[0].assignment_role, "PRIMARY_DOCTOR");
            assert.ok(calls.some((call) => call.params.includes("view")));
        }
    );
};

const testAssignableStaff = async () => {
    await withMockedQueries(
        async (sql) => {
            if (sql.includes("FROM users u") && sql.includes("GROUP_CONCAT")) {
                return [[{
                    id: 7,
                    username: "doctor001",
                    email: "doctor@example.com",
                    roles: "Doctor",
                }]];
            }

            throw new Error(`Unexpected query: ${sql}`);
        },
        async () => {
            const req = { user: { sub: "1", role: "Admin" } };
            const res = createResponse();

            await careTeamController.getAssignableStaff(req, res, (error) => {
                throw error;
            });

            assert.strictEqual(res.statusCode, 200);
            assert.strictEqual(res.body.data[0].roles, "Doctor");
        }
    );
};

const testAssignCareTeamMember = async () => {
    await withMockedQueries(
        async (sql) => {
            if (sql.includes("SELECT id FROM patients")) {
                return [[{ id: 5 }]];
            }

            if (sql.includes("SELECT id FROM users WHERE id")) {
                return [[{ id: 7 }]];
            }

            if (sql.includes("INSERT INTO patient_care_team")) {
                return [{ insertId: 12 }];
            }

            if (sql.includes("SELECT * FROM patient_care_team WHERE id")) {
                return [[{ id: 12, patient_id: 5, user_id: 7, role: "NURSE", is_active: 1 }]];
            }

            if (sql.includes("SELECT email FROM users")) {
                return [[{ email: "nurse@example.com" }]];
            }

            if (sql.includes("INSERT INTO audit_logs")) {
                return [{ insertId: 1 }];
            }

            throw new Error(`Unexpected query: ${sql}`);
        },
        async (calls) => {
            const req = {
                body: { patient_id: 5, user_id: 7, role: "NURSE" },
                user: { sub: "1", role: "Admin" },
            };
            const res = createResponse();

            await careTeamController.assignCareTeamMember(req, res, (error) => {
                throw error;
            });

            assert.strictEqual(res.statusCode, 201);
            assert.strictEqual(res.body.data.id, 12);
            assert.ok(calls.some((call) => call.params.includes("create")));
            assert.ok(calls.some((call) => call.params.includes("EMAIL_SKIPPED")));
        }
    );
};

const testDeactivateCareTeamMember = async () => {
    await withMockedQueries(
        async (sql) => {
            if (sql.includes("SELECT id, patient_id FROM patient_care_team")) {
                return [[{ id: 12, patient_id: 5 }]];
            }

            if (sql.includes("UPDATE patient_care_team SET is_active")) {
                return [{ affectedRows: 1 }];
            }

            if (sql.includes("SELECT * FROM patient_care_team WHERE id")) {
                return [[{ id: 12, patient_id: 5, user_id: 7, role: "NURSE", is_active: 0 }]];
            }

            if (sql.includes("INSERT INTO audit_logs")) {
                return [{ insertId: 1 }];
            }

            throw new Error(`Unexpected query: ${sql}`);
        },
        async (calls) => {
            const req = { params: { id: "12" }, user: { sub: "1", role: "Admin" } };
            const res = createResponse();

            await careTeamController.deactivateCareTeamMember(req, res, (error) => {
                throw error;
            });

            assert.strictEqual(res.statusCode, 200);
            assert.strictEqual(res.body.data.is_active, 0);
            assert.ok(calls.some((call) => call.params.includes("update")));
        }
    );
};

const testUnauthorizedAssignmentIsDenied = async () => {
    await withMockedQueries(
        async (sql) => {
            if (sql.includes("FROM patient_care_team pct")) {
                return [[]];
            }

            if (sql.includes("INSERT INTO audit_logs")) {
                return [{ insertId: 1 }];
            }

            throw new Error(`Unexpected query: ${sql}`);
        },
        async () => {
            const req = {
                body: { patient_id: 5, user_id: 7, role: "NURSE" },
                user: { sub: "9", role: "Doctor" },
            };
            const res = createResponse();

            await careTeamController.assignCareTeamMember(req, res, (error) => {
                throw error;
            });

            assert.strictEqual(res.statusCode, 403);
            assert.strictEqual(res.body.success, false);
        }
    );
};

const testCareTeamValidationFailures = async () => {
    const assignValidation = await runValidators(assignCareTeamMemberValidator, {
        body: { patient_id: "0", user_id: "", role: "" },
        params: {},
    });

    assert.strictEqual(assignValidation.nextCalled, false);
    assert.strictEqual(assignValidation.res.statusCode, 422);

    const patientValidation = await runValidators(patientCareTeamValidator, {
        body: {},
        params: { id: "bad" },
    });

    assert.strictEqual(patientValidation.nextCalled, false);
    assert.strictEqual(patientValidation.res.statusCode, 422);

    const deactivateValidation = await runValidators(deactivateCareTeamMemberValidator, {
        body: {},
        params: { id: "bad" },
    });

    assert.strictEqual(deactivateValidation.nextCalled, false);
    assert.strictEqual(deactivateValidation.res.statusCode, 422);
};

const runCareTeamManagementTests = async () => {
    await testViewPatientCareTeam();
    await testAssignableStaff();
    await testAssignCareTeamMember();
    await testDeactivateCareTeamMember();
    await testUnauthorizedAssignmentIsDenied();
    await testCareTeamValidationFailures();

    console.log("care team management tests passed");
};

if (require.main === module) {
    runCareTeamManagementTests().catch((error) => {
        db.query = originalQuery;
        console.error(error);
        process.exit(1);
    });
}

module.exports = runCareTeamManagementTests;
