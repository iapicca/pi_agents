# Implementation Template

Use this template when creating `.tmp/IMPLEMENTATION.md` from the IMPLEMENTATION PLANNER agent.

```markdown
# Implementation Plan: {{TASK_TITLE}}

## Task Reference
- **Issue:** #{{TASK_NUMBER}} - {{TASK_TITLE}}
- **URL:** {{ISSUE_URL}}
- **Parent Story:** #{{STORY_NUMBER}} - {{STORY_TITLE}}
- **Parent Feature:** #{{FEATURE_NUMBER}} - {{FEATURE_TITLE}}

## Context Summary
{{2-3 sentences summarizing what this task accomplishes within the larger feature}}

## Codebase Analysis

### Files to Modify
| File | Change Type | Description |
|------|-------------|-------------|
| `{{file_path}}` | Edit | {{specific change description}} |
| `{{new_file_path}}` | Create | {{purpose of new file}} |

### Relevant Existing Code
| File | Purpose | Key Elements |
|------|---------|--------------|
| `{{file_path}}` | {{purpose}} | {{function/name at line N}} |

### Patterns to Follow
- {{Pattern 1: e.g., Error handling conventions}}
- {{Pattern 2: e.g., Module export patterns}}
- {{Pattern 3: e.g., Naming conventions}}

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
| {{risk_description}} | {{mitigation_strategy}} |

## Acceptance Criteria Mapping
| Criterion | How to Verify |
|-----------|---------------|
| {{criterion_1}} | {{verification_method}} |
| {{criterion_2}} | {{verification_method}} |
```

## Usage Notes

### For IMPLEMENTATION PLANNER Agent

1. Fill in ALL sections - do not leave placeholders
2. Replace `{{VARIABLES}}` with actual content
3. File paths must be accurate and verified against the actual codebase
4. Linter command must be tested (run it to confirm it works)
5. Never include implementation code - only descriptions of what to implement
6. All key elements should reference specific line numbers where possible

### Required Fields

- Task reference with issue number and URL
- Context summary
- At least one file to modify
- Linter command (tested)
- Dependencies check (explicitly confirm no new deps)
- Acceptance criteria mapping

### Variable Definitions

- `{{TASK_NUMBER}}` - The GitHub issue number of the task
- `{{TASK_TITLE}}` - The task issue title
- `{{ISSUE_URL}}` - Full GitHub issue URL
- `{{STORY_NUMBER}}` - Parent story issue number
- `{{FEATURE_NUMBER}}` - Parent feature issue number
- `{{file_path}}` - Relative path to a file in the project
- `{{exact_linter_command}}` - Command to run the project's linter
- `{{dependency}}` - Name of any new dependency (should be rare)
