# Security Policy

## Supported use

This is an educational/demo application. It is not approved for production healthcare use or for storing protected health information.

## Reporting a vulnerability

Please do not open a public issue for a security vulnerability or expose credentials, tokens, patient data, or exploit details. Contact the repository owner privately with:

- A concise description of the issue.
- Reproduction steps using only synthetic data.
- The likely impact and affected component.

Allow reasonable time for acknowledgement and remediation before disclosure.

## Repository safety requirements

- Never commit `.env` files, database dumps, uploaded attachments, logs, private keys, access tokens, OTPs, or SMTP credentials.
- Use `.env.example` only as a variable template. Set a unique, high-entropy `JWT_SECRET` in every environment.
- Do not use real patient or staff information in tests, screenshots, documentation, or demo environments.
- Keep dependencies updated and run `npm audit` before releases.
- Use HTTPS, a managed secret store, restricted database credentials, secure backups, and centralized monitoring for any deployment.

## Known limitations

- The automated tests are mocked; no live-database or end-to-end security test suite exists yet.
- Attachments use local storage and have no virus scanning or object storage integration.
- Email notifications are synchronous and best-effort; no delivery queue or retry mechanism exists.
- Refresh-token rotation, rate limiting, account lockout, and a formal retention policy are not implemented.
