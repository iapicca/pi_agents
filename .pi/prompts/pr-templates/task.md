# Task PR Template

Use this template when creating Pull Requests for task → story merges from the PR-WRITER agent.

```markdown
## Related Issues
Fixes https://github.com/{{OWNER}}/{{REPO}}/issues/{{TASK_NUMBER}}

## Changes
{{LIST_OF_CHANGES}}

## Checklist
- [x] Code follows project style guidelines
- [x] Linter passes
- [x] Implementation matches task requirements
- [x] No new dependencies introduced (unless specified in issue)

## Reference
- **Task:** #{{TASK_NUMBER}}
- **Story:** #{{STORY_NUMBER}}
- **Feature:** #{{FEATURE_NUMBER}}
```

## Usage Notes

### For PR-WRITER Agent

1. Replace all `{{VARIABLES}}` with actual values before creating the PR
2. Keep the PR body brief and focused on the specific task
3. The "Fixes" link ensures the related task issue will be closed when the story branch is eventually merged

### Variable Definitions

- `{{TASK_NUMBER}}` - The GitHub issue number of the task being implemented
- `{{TASK_TITLE}}` - The title of the task issue
- `{{STORY_NUMBER}}` - The parent story issue number
- `{{FEATURE_NUMBER}}` - The parent feature issue number
- `{{VERSION}}` - Semantic version of the task (e.g., `1.1.2`)
- `{{OWNER}}` - GitHub repository owner/organization
- `{{REPO}}` - GitHub repository name
- `{{LIST_OF_CHANGES}}` - A list of new/changed files with brief description (max 40 chars) of the new code

### Important Rules

1. **Always include** the task's "Fixes" link
2. **Target branch** must always be the story branch, never main/master or the feature branch
3. Task PRs are auto-merged to the story branch
