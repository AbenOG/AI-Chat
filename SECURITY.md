# Security Policy

## Supported Versions

We release security updates on the main branch. Please use the latest commit or the most recent tagged release.

## Reporting a Vulnerability

- Please do not create public issues for security vulnerabilities.
- Email the maintainer with details and steps to reproduce. Include version/commit, OS, and configuration details.
- You will receive an acknowledgement within 72 hours. We aim to provide a fix or mitigation within 14 days.

## Handling Secrets

- Never commit `.env` or secrets. Use `.env.local` during development.
- The server requires `JWT_SECRET` and `ENCRYPTION_KEY` in production. Missing values will prevent the server from starting.

## Data Storage

- User API keys are encrypted at rest using AES-256-GCM with `ENCRYPTION_KEY`.
- Authentication tokens are issued as HTTP-only cookies with `sameSite=strict` and `secure` in production.

## CORS

- Allowed origin is restricted via `CORS_ORIGIN`.

## Dependencies

- Our CI runs `npm audit` at high severity. Please open a PR if you can help address advisories.

