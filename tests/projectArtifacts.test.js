const assert = require("assert");
const fs = require("fs");
const path = require("path");

const rootDir = path.join(__dirname, "..");

const envExample = fs.readFileSync(path.join(rootDir, ".env.example"), "utf8");
const apiDocs = fs.readFileSync(path.join(rootDir, "docs", "API.md"), "utf8");

[
    "PORT=5000",
    "DB_HOST=127.0.0.1",
    "DB_USER=app_user",
    "DB_PASSWORD=replace_with_a_strong_database_password",
    "DB_NAME=digital_health_records",
    "JWT_SECRET=replace_with_a_high_entropy_secret_at_least_32_characters_long",
    "JWT_EXPIRES_IN=1d",
].forEach((line) => {
    assert.ok(envExample.includes(line), `.env.example missing ${line}`);
});

[
    "POST /api/auth/register",
    "POST /api/auth/login",
    "POST /api/auth/verify-otp",
    "POST /api/auth/resend-otp",
    "POST /api/patients",
    "GET /api/patients",
    "GET /api/patients/:id",
    "GET /api/patients/:id/qr",
    "GET /api/patients/qr/:identifier",
    "PUT /api/patients/:id",
    "DELETE /api/patients/:id",
    "POST /api/records",
    "GET /api/records/patient/:id",
    "GET /api/records/:id",
    "PUT /api/records/:id",
    "POST /api/care-team",
    "PUT /api/care-team/:id/deactivate",
    "POST /api/vitals",
    "GET /api/vitals/patient/:id",
    "POST /api/labs",
    "GET /api/labs/patient/:id",
    "GET /api/audit",
    "GET /api/audit/patient/:id",
    "GET /api/audit/user/:id",
    "POST /api/break-glass/request",
    "POST /api/break-glass/:id/approve",
    "POST /api/break-glass/:id/reject",
    "GET /api/break-glass",
    "GET /api/break-glass/my-requests",
    "POST /api/uploads",
    "GET /api/uploads/patient/:id",
    "GET /api/uploads/:id",
    "DELETE /api/uploads/:id",
].forEach((route) => {
    assert.ok(apiDocs.includes(route), `API docs missing ${route}`);
});

console.log("project artifact tests passed");
