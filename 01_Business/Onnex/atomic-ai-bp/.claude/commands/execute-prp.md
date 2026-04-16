# Execute PRP

Implement a feature using the PRP file: `$ARGUMENTS`

## Process

### 1. Load Context
- Read the entire PRP file: `$ARGUMENTS`
- Understand all requirements, architecture, and success criteria
- Review all referenced examples and documentation URLs

### 2. Think Hard
Think hard before you execute the plan. Create a comprehensive plan addressing all requirements.

### 3. Plan
- Break down complex tasks into smaller, manageable steps using your todos tools
- Use the TodoWrite tool to create and track your implementation plan
- Identify implementation patterns from existing code to follow

### 4. Execute
- Implement each step in order
- Follow the patterns from `examples/` exactly
- Match existing code style and conventions
- Reference the architecture defined in the PRP

### 5. Validate
After each major step, run the validation gates defined in the PRP:
- Run specified test commands
- Check linting/formatting
- Verify functionality works as expected

### 6. Iterate
- If validation fails, use the error patterns in the PRP to fix and retry
- Do not move to the next step until current step passes validation
- Keep iterating until all success criteria are met

### 7. Complete
- Ensure all requirements from the PRP are met
- All validation gates pass
- Update the PRP status to complete
- Consider if CLAUDE.md needs updating

## Important Rules

- **Never skip validation gates** - they exist to catch issues early
- **Follow examples exactly** - don't invent new patterns
- **One step at a time** - complete and validate before moving on
- **If stuck** - re-read the PRP, check examples, search documentation URLs provided
