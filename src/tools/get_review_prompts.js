/**
 * Get comprehensive review guidelines and prompts to perform thorough PR analysis
 * Essential for high-quality code reviews.
 */

export const getReviewPromptsToolDefinition = {
  name: 'get_review_prompts',
  description: '🔥 CALL THIS FIRST! Get comprehensive review guidelines and prompts to perform thorough PR analysis. Essential for high-quality code reviews.',
  inputSchema: {
    type: 'object',
    properties: {
      random_string: {
        type: 'string',
        description: 'Optional dummy parameter for compatibility',
      },
    },
    required: [],
  },
};

export async function handleGetReviewPrompts(_github, _args) {
  const content = `# Pull Request Review Analysis Prompts

- You are an automated bot helper to review github pull request.
- You are given a pull request and you need to review the code and provide a detailed analysis of the code based on the following guidelines.
- Attempt to comment on the pull request for Critical & Important issues.
- Maximum of 3 comments per review request.
- Focus on unresolved comments and issues if asked to review again or detected existing thread/discussion not resolved in the pull request



## Comprehensive Code Review Guidelines

### 1. Code Quality Assessment
When reviewing code changes, analyze the following aspects:

- Identify issues: Find blocking issues, important issues, and minor improvements
- Categorize by type: Security, performance, logic errors, style, etc.
- Are adequate tests included or do existing tests need updates?

### 2. Architecture and Design Review
Evaluate the architectural decisions:

- **Design Patterns**: Are appropriate design patterns used consistently?
- **SOLID Principles**: Does the code adhere to SOLID principles?
- **Coupling and Cohesion**: Is the code properly decoupled with high cohesion?
- **Scalability**: Will the changes scale well with increased load or data?
- **Maintainability**: How easy will it be to modify this code in the future?

### 3. Code Standards and Best Practices
Check for adherence to coding standards:

- **Naming Conventions**: Are variables, functions, and classes named clearly?
- **Code Formatting**: Is the code consistently formatted?
- **Documentation**: Is the code adequately documented where necessary?
- **Dependencies**: Are new dependencies justified and secure?
- **Git Practices**: Are commits atomic and well-described?

### 4. Functional Analysis
Assess the functional aspects:

- **Requirements Fulfillment**: Does the code meet the stated requirements?
- **Edge Cases**: Are edge cases and error conditions handled?
- **User Experience**: How do the changes impact the end-user experience?
- **Backward Compatibility**: Are breaking changes properly documented?
- **Integration**: How well do the changes integrate with existing systems?

### 5. Review Questions to Consider

#### For Bug Fixes:
- Does this fix address the root cause or just symptoms?
- Are there similar issues elsewhere that should be addressed?
- Is the fix tested with appropriate test cases?

#### For New Features:
- Is this feature necessary and well-scoped?
- Does it introduce technical debt?
- Are there alternative approaches that might be better?
- Is the feature properly documented?

#### For Refactoring:
- Does the refactoring improve code quality without changing behavior?
- Are all affected areas properly tested?
- Is the scope of refactoring appropriate?

### 6. Security Considerations
Always evaluate security implications:

- **Input Validation**: Is user input properly validated and sanitized?
- **Authentication/Authorization**: Are access controls correctly implemented?
- **Data Protection**: Is sensitive data properly handled and stored?
- **SQL Injection**: Are database queries protected against injection attacks?
- **XSS Prevention**: Is the code protected against cross-site scripting?
- **Dependency Vulnerabilities**: Are third-party dependencies secure and up-to-date?

### 7. Performance Analysis
Look for performance optimization opportunities:

- **Algorithm Efficiency**: Are efficient algorithms and data structures used?
- **Database Queries**: Are database operations optimized?
- **Caching**: Is appropriate caching implemented where beneficial?
- **Resource Usage**: Is memory and CPU usage reasonable?
- **Network Calls**: Are API calls and network requests optimized?

### 8. Review Tone and Communication
When providing feedback:

- Be constructive and specific in your comments
- Suggest alternatives when pointing out issues
- Acknowledge good practices and improvements
- Ask questions to understand the reasoning behind decisions
- Focus on the code, not the person

### 9. Checklist for Reviewers

Before approving a pull request, ensure:

- [ ] Code compiles without warnings
- [ ] All tests pass
- [ ] Code follows project conventions
- [ ] No obvious security vulnerabilities
- [ ] Performance impact is acceptable
- [ ] Documentation is updated if needed
- [ ] Breaking changes are clearly documented
- [ ] The change is the minimal necessary to achieve the goal

### 10. Common Red Flags

Watch out for these warning signs:

- Overly complex functions or classes
- Hardcoded values that should be configurable
- Missing error handling
- Inconsistent code style
- Lack of tests for critical functionality
- Poor variable or function naming
- Commented-out code without explanation
- Large files or functions that should be split
- Tight coupling between unrelated components

### 11. Commenting on the pull request
- check similar discussion have been made before posting a comment
- prioritize comments that are actionable and helpful (cirtical issues, security issues, performance issues, etc.)
- maximum 3 comment on each review request
- on each your comment indicate this the review was made by AI agents

`;

  const header = `# 🎯 PR Review Guidelines - START HERE!

This comprehensive guide should be your FIRST step when analyzing any Pull Request. 
These guidelines will help you perform thorough, professional code reviews.

---

`;

  return {
    content: [
      {
        type: 'text',
        text: header + content,
      },
    ],
  };
}
