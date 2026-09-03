# Project Status

## Current scope

The application provides an Express API and Bootstrap interface for a digital-health-record demonstration. Core workflows include authentication, RBAC, patient care-team access, clinical records, audit events, attachments, QR lookup, emergency access, and RBAC administration.

## Deployment prerequisites

- Review and apply the SQL schema and migrations to a dedicated MySQL environment.
- Configure a strong JWT secret and least-privilege database account through environment variables.
- Configure SMTP only in a protected environment if OTP or notification delivery is required.
- Use a reverse proxy with HTTPS and configure CORS for the intended frontend origin.

## Limitations and planned work

- No live database integration tests or formal compliance assessment.
- Local attachment storage lacks malware scanning and lifecycle controls.
- Notifications have no queue, retry, or delivery monitoring.
- Refresh tokens, rate limiting, lockout controls, and a data retention policy remain future work.

Internal implementation notes and academic test materials are intentionally excluded from the public repository. This document is the public, de-identified project summary.
