# Story Implementation Template

Use this template when creating `story-implementation-{N.M}.md` from the IMPLEMENTATION PLANNER agent.

```markdown
# Story Implementation Plan: [{{STORY_VERSION}}] {{STORY_TITLE}}

## Story Reference
- **Issue:** #{{STORY_NUMBER}} - {{STORY_TITLE}}
- **URL:** {{STORY_URL}}
- **Parent Feature:** #{{FEATURE_NUMBER}} - [{{FEATURE_VERSION}}] {{FEATURE_TITLE}}
- **Feature Plan:** `feat-implementation-{{FEATURE_VERSION}}.md`

## Strategy Overview
{{High-level implementation strategy for this story. How it fits into the feature.
Key design decisions at the story level. Approach to implementation.}}

## Story Scope
{{What this story covers and what it explicitly does NOT cover. Boundaries within
the larger feature.}}

## Task Interactions

Brief descriptions of how each task interacts with the story, other tasks, and the codebase:

| Task | Version | Interaction (max 80 chars) |
|------|---------|---------------------------|
| {{Task title}} | {{N.M.P}} | {{Brief interaction description}} |

## Dependencies on Other Stories
{{Any dependencies or ordering constraints with other stories in the same feature.
What must be completed before this story can be fully functional.}}

## Implementation Checklist

### Tasks
- [ ] [{{N.M.P}}] {{Task title}}
- [ ] [{{N.M.P}}] {{Task title}}
- [ ] [{{N.M.P}}] {{Task title}}

## Codebase Patterns
{{Relevant patterns from the codebase that this story should follow. Reference to
existing code, conventions, and architectural decisions.}}

## Testing Strategy
{{How this story should be tested. Unit tests, integration tests, manual testing notes.}}

## Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| {{Risk description}} | {{Mitigation strategy}} |

## Acceptance Criteria Mapping
| Criterion | How to Verify |
|-----------|---------------|
| {{Criterion 1}} | {{Verification method}} |
| {{Criterion 2}} | {{Verification method}} |
```

## Usage Notes

### For IMPLEMENTATION PLANNER Agent

1. Fill in ALL sections - do not leave placeholders
2. Task interaction descriptions MUST be 80 characters or fewer
3. Do NOT duplicate content from the parent feature plan - REFERENCE it instead
4. Do NOT include specific file/line changes - those belong in task-implementation files
5. Focus on story strategy and cross-task relationships only
6. Always reference the parent feature plan file, never repeat its architecture content

### Required Fields

- Story reference with issue number, URL, and parent feature
- Strategy overview
- Task interaction table (all tasks listed)
- Implementation checklist (all tasks with unchecked boxes)
- Dependencies on other stories

### Variable Definitions

- `{{STORY_NUMBER}}` - The GitHub issue number of the story
- `{{STORY_TITLE}}` - The story issue title
- `{{STORY_VERSION}}` - The story version (e.g., `1.1`, `1.2`)
- `{{STORY_URL}}` - Full GitHub story issue URL
- `{{FEATURE_NUMBER}}` - The parent feature issue number
- `{{FEATURE_TITLE}}` - The parent feature title
- `{{FEATURE_VERSION}}` - The parent feature version (e.g., `1`, `2`)
- `{{N.M.P}}` - Task version number (e.g., `1.1.1`, `1.1.2`)
