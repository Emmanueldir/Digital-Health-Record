# Testing Guide

## Scope

The automated tests cover token payload safety, authentication flows, authorization, care-team access, break-glass access, uploads, QR lookup, notifications, and RBAC administration. Test fixtures use fictional values only.

Run the suite with:

```bash
npm test
```

## Manual verification

Use only a local database populated with synthetic records. Verify the following workflows:

- Staff login requires OTP verification; patient login follows the configured patient flow.
- Unauthorized roles and users outside a patient's care team receive `401` or `403` responses.
- An approved, unexpired break-glass request is required for emergency access outside the care team.
- Attachment validation rejects unsupported file types and files over the configured size limit.
- QR responses contain an identifier rather than clinical data.
- Role and permission changes are available only to authorized administrators and create audit events.

## Limitations

The current tests mock database calls and email transport behaviour. Before any production consideration, add integration tests against an isolated database, end-to-end tests, dependency scanning, authorization regression tests, and a professional security assessment.
