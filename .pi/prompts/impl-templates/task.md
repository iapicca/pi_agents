# Task Implementation Template

Use this template when creating `task-implementation-{N.M.P}.md` from the IMPLEMENTATION PLANNER agent.

```markdown
# Task Implementation Plan: [{{TASK_VERSION}}] {{TASK_TITLE}}

## Task Reference
- **Issue:** #{{TASK_NUMBER}} - {{TASK_TITLE}}
- **URL:** {{TASK_URL}}
- **Parent Story:** #{{STORY_NUMBER}} - [{{STORY_VERSION}}] {{STORY_TITLE}}
- **Story Plan:** `story-implementation-{{STORY_VERSION}}.md`
- **Parent Feature:** #{{FEATURE_NUMBER}} - [{{FEATURE_VERSION}}] {{FEATURE_TITLE}}
- **Feature Plan:** `feat-implementation-{{FEATURE_VERSION}}.md`

## Context Summary
{{2-3 sentences summarizing this task within the story and feature. Reference parent
plans for architecture and strategy - do NOT repeat that content here.}}

## Codebase Analysis

### Files to Modify
| File | Change Type | Description |
|------|-------------|-------------|
| `{{file_path}}` | Edit | {{Specific change description}} |
| `{{new_file_path}}` | Create | {{Purpose of new file}} |

### Relevant Existing Code
| File | Purpose | Key Elements |
|------|---------|--------------|
| `{{file_path}}` | {{purpose}} | {{function/name at line N}} |

### Patterns to Follow
- {{Pattern 1: e.g., Error handling conventions}}
- {{Pattern 2: e.g., Module export patterns}}

## Implementation Strategy

### Approach
{{Description of the chosen approach and why it is appropriate}}

### Step-by-Step Plan
1. {{Step 1: specific action with exact file and approximate line reference}}
2. {{Step 2: specific action with exact file and approximate line reference}}
3. {{Step 3: specific action with exact file and approximate line reference}}

### Edge Cases
- {{Edge case 1 and how to handle it}}
- {{Edge case 2 and how to handle it}}

## Linter Configuration

### Command
```bash
{{exact_linter_command}}
```

### Fix Command
```bash
{{exact_fix_command_if_available}}
```

### Configuration Files
- `{{config_path}}` - {{relevant rules or settings}}

## Dependencies Check

### Current Dependencies
{{List of relevant current dependencies from package manager files}}

### New Dependencies Required
- [ ] None (no new dependencies needed)
- OR
- [ ] `{{dependency}}` - {{justification, must come from issue}}

### Verification
{{Explicit confirmation that implementation does not introduce unauthorized dependencies}}

## Testing Notes
{{Notes on any tests that need to be added, modified, or run}}

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
2. File paths must be accurate and verified against the actual codebase
3. Linter command must be tested (run it to confirm it works)
4. Never include implementation code - only descriptions of what to implement
5. All key elements should reference specific line numbers where possible
6. Do NOT duplicate content from parent feature or story plans - REFERENCE them

### Required Fields

- Task reference with issue number, URL, and parent story/feature
- Context summary (brief, referencing parent plans)
- At least one file to modify
- Linter command (tested)
- Dependencies check (explicitly confirm no new deps)
- Acceptance criteria mapping

### Variable Definitions

- `{{TASK_NUMBER}}` - The GitHub issue number of the task
- `{{TASK_TITLE}}` - The task issue title
- `{{TASK_VERSION}}` - The task version (e.g., `1.1.1`, `1.2.3`)
- `{{TASK_URL}}` - Full GitHub task issue URL
- `{{STORY_NUMBER}}` - Parent story issue number
- `{{STORY_VERSION}}` - Parent story version (e.g., `1.1`, `1.2`)
- `{{FEATURE_NUMBER}}` - Parent feature issue number
- `{{FEATURE_VERSION}}` - Parent feature version (e.g., `1`, `2`)
- `{{file_path}}` - Relative path to a file in the project
- `{{exact_linter_command}}` - Command to run the project's linter
- `{{dependency}}` - Name of any new dependency (should be rare)
