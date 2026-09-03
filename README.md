# Digital Health Record System

A learning and demonstration project for managing digital health records through a Node.js/Express REST API and a Bootstrap frontend. It implements role-based and patient-specific access controls for core clinical workflows.

> **Important:** This repository is not production-ready and must not be used to store real patient data. It has not been certified for HIPAA, NDPR, GDPR, or any other regulatory framework.

## Features

- Password authentication with bcrypt, JWT access tokens, and OTP verification for staff roles.
- Role- and permission-based access control, plus patient care-team restrictions.
- Patient profiles, medical records, vitals, laboratory results, attachments, audit logs, and QR lookup.
- Emergency, time-limited break-glass access with approval and audit events.
- Dynamic administration of roles, permissions, and user-role assignments.
- Bootstrap frontend served at `/app`.

## Technology

- Node.js and Express 5
- MySQL with `mysql2`
- Bootstrap 5 and vanilla JavaScript
- JWT, bcrypt, Multer, Nodemailer, Helmet, CORS, and express-validator

## Local setup

1. Install Node.js 18 or later and MySQL 8 or later.
2. Install packages:

   ```bash
   npm install
   ```

3. Copy `.env.example` to `.env` and supply local values. Generate a strong JWT secret, for example with `openssl rand -base64 48`.
4. Create an empty database and apply `database/schema.sql`, then `database/seeds.sql` and the reviewed changes in `database/schema_updates.sql`.
5. Start the service:

   ```bash
   npm start
   ```

The API is available at `http://localhost:5000`; the frontend is at `http://localhost:5000/app`.

## Testing

```bash
npm test
```

The test suite uses mocked database interactions. It is not a substitute for integration, security, or penetration testing. See [testing guidance](docs/TESTING.md).

## Documentation

- [API reference](docs/API.md)
- [Authentication reference](docs/auth-api.md)
- [Architecture overview](docs/system-architecture-diagram.md)
- [Project status and limitations](docs/PROJECT_STATUS.md)
- [Security policy](SECURITY.md)
- [Contributing guide](CONTRIBUTING.md)

## Data and security boundaries

- Do not commit `.env`, database exports, logs, JWTs, mail credentials, or uploaded attachments.
- Use fictional or fully de-identified data in local development and tests.
- Configure SMTP only in protected environments; notification delivery is best-effort.
- Review database migrations before applying them to any environment.

## License

No license has been selected. All rights are reserved until a license is added by the repository owner.
