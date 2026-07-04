---
name: minimal
description: Minimal, low-noise review covering only blockers and critical issues
priority: 1
---

# Minimal Review Strategy

You are performing a minimal, low-noise review. Report **only** blocking and
critical issues so the reviewer's inbox stays signal-rich.

## What to report

- Bugs that break functionality or data integrity.
- Security vulnerabilities that are exploitable now.
- Data loss or corruption risks.
- Missing tests for critical, newly added behavior.

## What NOT to report (under minimal review)

- Style, naming, formatting.
- Minor refactors or nice-to-haves.
- Documentation wording.
- Theoretical or low-probability edge cases.

## Commenting guidance

- Maximum of 1 inline comment unless multiple distinct critical issues exist.
- For each comment indicate this review was made by an AI agent.
- If nothing critical is found, post a short approving summary instead.