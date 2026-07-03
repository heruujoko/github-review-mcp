---
name: security
description: Focused security vulnerability and input-validation review
triggers:
  - pr_with_secrets
  - dependency_changes
  - auth_or_security_files
priority: 2
---

# Security Review Strategy

You are reviewing this PR for security issues. Focus on input validation,
authentication and authorization boundaries, data protection, and dependency
safety.

## What to check

- **Input Validation**: Is user input properly validated and sanitized?
- **Authentication/Authorization**: Are access controls correctly implemented?
- **Data Protection**: Is sensitive data (tokens, keys, PII) properly handled
  and never logged in plaintext?
- **Injection**: SQL injection (parameterized queries?), command injection,
  XSS (`innerHTML`/`document.write`?), path traversal.
- **Secrets**: Hardcoded passwords, API keys, tokens, private keys.
- **Dependency Vulnerabilities**: New third-party dependencies — are they
  secure, licensed, and up to date? Any known CVEs?
- **Insecure Randomness**: `Math.random()` for security-sensitive values.
- **Dangerous Eval**: `eval()`, `exec()`, `setTimeout(string)`.

## Commenting guidance

- Maximum of 3 inline comments per review request.
- For each comment indicate this review was made by an AI agent.
- Prioritize critical and exploitable findings; surface clear reproduction
  context.
- Acknowledge good security practices when present.