# Contributing

## Before you start

- Use synthetic, de-identified data only.
- Keep secrets in a local `.env`; never add it to a commit.
- Do not add uploads, database exports, screenshots containing records, or generated logs.

## Development workflow

1. Create a branch for a focused change.
2. Add or update tests with the implementation.
3. Run `npm test`.
4. Update public documentation when routes, configuration, or security behaviour changes.
5. Keep pull requests small and explain any migration steps or security impact.

## Code guidelines

- Use parameterized SQL queries.
- Validate input at route boundaries.
- Preserve authorization and audit checks around protected patient resources.
- Return generic errors; do not expose internal errors, credentials, or personal information in logs or responses.
