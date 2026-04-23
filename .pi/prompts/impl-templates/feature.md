# Feature Implementation Template

Use this template when creating `feat-implementation-{N}.md` from the IMPLEMENTATION PLANNER agent.

```markdown
# Feature Implementation Plan: [{{FEATURE_VERSION}}] {{FEATURE_TITLE}}

## Feature Reference
- **Issue:** #{{FEATURE_NUMBER}} - {{FEATURE_TITLE}}
- **URL:** {{FEATURE_URL}}

## Architecture Overview
{{High-level architecture and design decisions for the feature. How it fits into the
overall system. Key patterns, technologies, and structural decisions.}}

## Codebase Impact
{{How this feature affects the existing codebase. Which major components are touched,
modified, or introduced. Any breaking changes or migration considerations.}}

## Story Interactions

Brief descriptions of how each story interacts with the feature and the codebase:

| Story | Version | Interaction (max 80 chars) |
|-------|---------|---------------------------|
| {{Story title}} | {{N.M}} | {{Brief interaction description}} |

## Implementation Checklist

### Stories
- [ ] [{{N.M}}] {{Story title}}
- [ ] [{{N.M}}] {{Story title}}
- [ ] [{{N.M}}] {{Story title}}

## Risk Assessment
| Risk | Mitigation |
|------|------------|
| {{Risk description}} | {{Mitigation strategy}} |

## Cross-Cutting Concerns
- {{Concern 1: e.g., Logging, monitoring, security}}
- {{Concern 2: e.g., Performance implications}}
- {{Concern 3: e.g., Backward compatibility}}

## References
- Parent PLAN.md section: {{section reference}}
- Official documentation: {{links}}
```

## Usage Notes

### For IMPLEMENTATION PLANNER Agent

1. Fill in ALL sections - do not leave placeholders
2. Story interaction descriptions MUST be 80 characters or fewer
3. Do NOT include task-level details - those belong in story-implementation files
4. Do NOT include specific file/line changes - those belong in task-implementation files
5. Focus on architecture and cross-story relationships only

### Required Fields

- Feature reference with issue number and URL
- Architecture overview
- Codebase impact summary
- Story interaction table (all stories listed)
- Implementation checklist (all stories with unchecked boxes)

### Variable Definitions

- `{{FEATURE_NUMBER}}` - The GitHub issue number of the feature
- `{{FEATURE_TITLE}}` - The feature issue title
- `{{FEATURE_VERSION}}` - The feature version (e.g., `1`, `2`)
- `{{FEATURE_URL}}` - Full GitHub feature issue URL
- `{{N.M}}` - Story version number (e.g., `1.1`, `1.2`)
