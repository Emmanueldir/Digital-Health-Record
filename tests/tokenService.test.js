const assert = require("assert");
const jwt = require("jsonwebtoken");
const { generateToken } = require("../src/services/tokenService");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.JWT_EXPIRES_IN = "1h";

const accessToken = generateToken({
  id: 12,
  email: "doctor@example.com",
  role: "Doctor",
  permissions: ["view_patient", "edit_medical_record"],
});

const decoded = jwt.verify(accessToken, process.env.JWT_SECRET);

assert.strictEqual(decoded.sub, "12");
assert.strictEqual(decoded.email, "doctor@example.com");
assert.strictEqual(decoded.role, "Doctor");
assert.deepStrictEqual(decoded.permissions, [
  "view_patient",
  "edit_medical_record",
]);
assert.ok(decoded.iat);
assert.ok(decoded.exp);
assert.strictEqual(decoded.id, undefined);
assert.strictEqual(decoded.password_hash, undefined);

console.log("tokenService payload test passed");
