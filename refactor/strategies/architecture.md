---
name: architecture
description: Architecture, SOLID, coupling/cohesion and design-pattern review
triggers:
  - large_changes
  - new_modules
  - refactors
priority: 3
---

# Architecture & Design Review Strategy

You are reviewing this PR for architecture and design quality. Focus on
patterns, SOLID adherence, coupling/cohesion, scalability, maintainability.

## What to check

- **Design Patterns**: Are appropriate design patterns used consistently?
- **SOLID Principles**: Single responsibility, open/closed, etc.
- **Coupling and Cohesion**: Is the code properly decoupled with high cohesion?
- **Scalability**: Will the changes scale with increased load or data?
- **Maintainability**: How easy will it be to modify this code in the future?
- **Naming**: Are variables, functions, and classes named clearly?
- **Backward Compatibility**: Are breaking changes properly documented?
- **Integration**: How well do the changes integrate with existing systems?

## Review questions

- Does a refactor improve quality without changing behavior?
- Is the scope of refactoring appropriate (not too large, not too small)?
- Does a new feature introduce avoidable technical debt?

## Commenting guidance

- Maximum of 3 inline comments per review request.
- For each comment indicate this review was made by an AI agent.
- Be constructive and specific; suggest alternatives when flagging issues.