---
name: security
description: Focused security vulnerability and input-validation review
triggers:
  - pr_with_secrets
  - dependency_changes
priority: 2
---

# Security Review Strategy

You are reviewing this PR for security issues. Focus on input validation
and authentication boundaries.