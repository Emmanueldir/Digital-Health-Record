const assert = require("assert");

const db = require("../src/config/db");
const {
    MAX_FILE_SIZE_BYTES,
    isAllowedFile,
    isFileSizeAllowed,
    createAttachment,
    deleteAttachment,
} = require("../src/services/uploadService");
const { sendNotification } = require("../src/services/notificationService");
const {
    formatQrIdentifier,
    generateQrImage,
    assignQrToPatient,
    getPatientIdByQrIdentifier,
} = require("../src/services/qrService");
const { requireCareTeamAccess } = require("../src/middleware/accessMiddleware");

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

const testUploadConstraints = () => {
    assert.strictEqual(isAllowedFile({ originalname: "report.pdf", mimetype: "application/pdf" }), true);
    assert.strictEqual(isAllowedFile({ originalname: "scan.jpg", mimetype: "image/jpeg" }), true);
    assert.strictEqual(isAllowedFile({ originalname: "script.exe", mimetype: "application/octet-stream" }), false);
    assert.strictEqual(isAllowedFile({ originalname: "fake.pdf", mimetype: "application/javascript" }), false);
    assert.strictEqual(isFileSizeAllowed({ size: MAX_FILE_SIZE_BYTES }), true);
    assert.strictEqual(isFileSizeAllowed({ size: MAX_FILE_SIZE_BYTES + 1 }), false);
};

const testSuccessfulUploadMetadataIsSanitized = async () => {
    await withMockedQueries(
        async (sql) => {
            if (sql.includes("SELECT id FROM patients")) {
                return [[{ id: 5 }]];
            }

            if (sql.includes("INSERT INTO attachments")) {
                return [{ insertId: 12 }];
            }

            if (sql.includes("FROM attachments")) {
                return [[{
                    id: 12,
                    patient_id: 5,
                    uploaded_by: 7,
                    file_name: "report.pdf",
                    file_type: "application/pdf",
                    file_size: 2048,
                    file_url: "server-only-name.pdf",
                    description: "Lab report",
                    created_at: new Date(),
                }]];
            }

            throw new Error(`Unexpected query: ${sql}`);
        },
        async () => {
            const attachment = await createAttachment({
                req: { user: { sub: "7", role: "Doctor" } },
                patientId: 5,
                description: "Lab report",
                file: {
                    originalname: "report.pdf",
                    mimetype: "application/pdf",
                    size: 2048,
                    filename: "server-only-name.pdf",
                },
            });

            assert.strictEqual(attachment.id, 12);
            assert.strictEqual(attachment.file_url, undefined);
        }
    );
};

const testDeleteAttachmentAuthorization = async () => {
    await withMockedQueries(
        async (sql) => {
            if (sql.includes("FROM attachments")) {
                return [[{
                    id: 12,
                    patient_id: 5,
                    uploaded_by: 99,
                    file_name: "report.pdf",
                    file_type: "application/pdf",
                    file_size: 2048,
                    file_url: "server-only-name.pdf",
                    description: null,
                    created_at: new Date(),
                }]];
            }

            throw new Error(`Unexpected query: ${sql}`);
        },
        async () => {
            await assert.rejects(
                () => deleteAttachment({
                    req: { user: { sub: "7", role: "Doctor" } },
                    attachmentId: 12,
                }),
                (error) => error.statusCode === 403
            );
        }
    );
};

const testEmailNotificationAuditing = async () => {
    await withMockedQueries(
        async (sql) => {
            if (sql.includes("INSERT INTO audit_logs")) {
                return [{ insertId: 1 }];
            }

            throw new Error(`Unexpected query: ${sql}`);
        },
        async (calls) => {
            const skipped = await sendNotification({
                req: { user: { sub: "1", role: "Admin" } },
                to: "doctor@example.com",
                subject: "Test",
                text: "Test message",
                resourceType: "email",
            });

            const failed = await sendNotification({
                req: { user: { sub: "1", role: "Admin" } },
                to: null,
                subject: "Test",
                text: "Test message",
                resourceType: "email",
            });

            assert.strictEqual(skipped.sent, false);
            assert.strictEqual(skipped.skipped, true);
            assert.strictEqual(failed.sent, false);
            assert.ok(calls.some((call) => call.params.includes("EMAIL_SKIPPED")));
            assert.ok(calls.some((call) => call.params.includes("EMAIL_FAILED")));
        }
    );
};

const testQrGeneration = async () => {
    assert.strictEqual(formatQrIdentifier(5), "PAT-000005");

    const qrImage = await generateQrImage("PAT-000005");
    assert.ok(qrImage.startsWith("data:image/png;base64,"));

    await withMockedQueries(
        async (sql) => {
            if (sql.includes("SELECT id, qr_identifier, qr_image_url FROM patients")) {
                return [[{ id: 5, qr_identifier: null, qr_image_url: null }]];
            }

            if (sql.includes("UPDATE patients SET qr_identifier")) {
                return [{ affectedRows: 1 }];
            }

            if (sql.includes("INSERT INTO audit_logs")) {
                return [{ insertId: 1 }];
            }

            throw new Error(`Unexpected query: ${sql}`);
        },
        async (calls) => {
            const qr = await assignQrToPatient({
                req: { user: { sub: "1", role: "Admin" } },
                patientId: 5,
            });

            assert.strictEqual(qr.qrIdentifier, "PAT-000005");
            assert.ok(qr.qrImage.startsWith("data:image/png;base64,"));
            assert.ok(calls.some((call) => call.params.includes("QR_GENERATED")));
        }
    );
};

const testQrAccessPaths = async () => {
    await withMockedQueries(
        async (sql) => {
            if (sql.includes("SELECT id FROM patients WHERE qr_identifier")) {
                return [[{ id: 5 }]];
            }

            if (sql.includes("FROM patient_care_team")) {
                return [[{ id: 1 }]];
            }

            throw new Error(`Unexpected query: ${sql}`);
        },
        async () => {
            const allowed = await runMiddleware(
                requireCareTeamAccess(() => getPatientIdByQrIdentifier("PAT-000005")),
                { user: { sub: "7", role: "Doctor" }, params: {}, body: {} }
            );

            assert.strictEqual(allowed.nextCalled, true);
        }
    );

    await withMockedQueries(
        async (sql) => {
            if (sql.includes("SELECT id FROM patients WHERE qr_identifier")) {
                return [[{ id: 5 }]];
            }

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
            const allowed = await runMiddleware(
                requireCareTeamAccess(() => getPatientIdByQrIdentifier("PAT-000005")),
                { user: { sub: "7", role: "Doctor" }, params: {}, body: {} }
            );

            assert.strictEqual(allowed.nextCalled, true);
        }
    );

    await withMockedQueries(
        async (sql) => {
            if (sql.includes("SELECT id FROM patients WHERE qr_identifier")) {
                return [[{ id: 5 }]];
            }

            if (sql.includes("FROM patient_care_team")) {
                return [[]];
            }

            if (sql.includes("FROM break_glass_requests")) {
                return [[]];
            }

            if (sql.includes("INSERT INTO audit_logs")) {
                return [{ insertId: 1 }];
            }

            throw new Error(`Unexpected query: ${sql}`);
        },
        async () => {
            const denied = await runMiddleware(
                requireCareTeamAccess(() => getPatientIdByQrIdentifier("PAT-000005")),
                { user: { sub: "7", role: "Doctor" }, params: {}, body: {} }
            );

            assert.strictEqual(denied.nextCalled, false);
            assert.strictEqual(denied.res.statusCode, 403);
        }
    );
};

const runSprint5Tests = async () => {
    testUploadConstraints();
    await testSuccessfulUploadMetadataIsSanitized();
    await testDeleteAttachmentAuthorization();
    await testEmailNotificationAuditing();
    await testQrGeneration();
    await testQrAccessPaths();

    console.log("sprint 5 tests passed");
};

if (require.main === module) {
    runSprint5Tests().catch((error) => {
        db.query = originalQuery;
        console.error(error);
        process.exit(1);
    });
}

module.exports = runSprint5Tests;
