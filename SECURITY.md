# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| Latest  | Yes                |

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it responsibly.

### How to Report

1. **Do not** open a public GitHub issue for security vulnerabilities
2. Email the maintainers directly or use GitHub's private vulnerability reporting feature
3. Include as much detail as possible:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### What to Expect

- Acknowledgment of your report within 48 hours
- Regular updates on the progress of addressing the vulnerability
- Credit in the security advisory (unless you prefer to remain anonymous)

### Scope

The following are in scope for security reports:

- Authentication and authorization flaws
- Token handling and storage vulnerabilities
- SQL injection or other injection attacks
- Cross-site scripting (XSS)
- Cross-site request forgery (CSRF)
- Sensitive data exposure
- API security issues

### Out of Scope

- Rate limiting effectiveness (this is intentionally configurable)
- Denial of service via high volume requests
- Social engineering attacks
- Vulnerabilities in third-party dependencies (report these upstream)

## Security Measures

This project implements several security measures:

### Token Security

- OAuth tokens are encrypted at rest using AES-256-GCM before database storage
- Tokens are never exposed to the client or included in API responses
- Token encryption keys are stored as environment secrets

### Session Security

- Sessions use signed cookies with httpOnly and secure flags
- Session secrets are stored as environment secrets
- CSRF protection via OAuth state parameter validation

### Database Security

- Parameterized queries to prevent SQL injection
- Database credentials stored as environment secrets
- Connection pooling via Cloudflare Hyperdrive

### API Security

- IP-based rate limiting on all public endpoints
- Input validation on all user-provided data
- No sensitive data in error responses

## Responsible Disclosure

We kindly ask that you:

- Give us reasonable time to address the issue before public disclosure
- Make a good faith effort to avoid privacy violations and data destruction
- Do not access or modify data belonging to other users

We commit to:

- Not pursue legal action against researchers who follow this policy
- Work with you to understand and resolve the issue quickly
- Credit you in any public disclosure (with your permission)
