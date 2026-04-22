# PR Template

Use this template when creating Pull Requests from the PR-WRITER agent.

```markdown
## Related Issues
Fixes https://github.com/{{OWNER}}/{{REPO}}/issues/{{TASK_NUMBER}}
{{#if IS_LAST_TASK}}
Fixes https://github.com/{{OWNER}}/{{REPO}}/issues/{{STORY_NUMBER}}
{{/if}}\

## Changes
{{LIST_OF_CHANGES}}

## Checklist
- [x] Code follows project style guidelines
- [x] Linter passes
- [x] Implementation matches task requirements
- [x] No new dependencies introduced (unless specified in issue)

## Reference
- **Story:** #{{STORY_NUMBER}}
- **Feature:** #{{FEATURE_NUMBER}}
```

## Usage Notes

### For PR-WRITER Agent

1. Replace all `{{VARIABLES}}` with actual values before creating the PR
2. The `IS_LAST_TASK` block should only be included if this is the final task of its parent story
3. Keep the PR body brief and focused on the specific task
4. The "Fixes" link ensures the related issue will be closed when the feature branch is eventually merged to main

### Variable Definitions

- `{{TASK_NUMBER}}` - The GitHub issue number of the task being implemented
- `{{TASK_TITLE}}` - The title of the task issue
- `{{STORY_NUMBER}}` - The parent story issue number
- `{{FEATURE_NUMBER}}` - The parent feature issue number
- `{{VERSION}}` - Semantic version of the task (e.g., `1.1.2`)
- `{{OWNER}}` - GitHub repository owner/organization
- `{{REPO}}` - GitHub repository name
- `{{IS_LAST_TASK}}` - Set to `true` only if this is the last task of the story
- `{{LIST_OF_CHANGES}}` - A list of new/changed files with brief description(max 40 chars) of the new code

### Important Rules

1. **Always include** the task's "Fixes" link
2. **Conditionally include** the story's "Fixes" link only for the last task of a story
3. **Never include** the feature's "Fixes" link (features are closed by the final story or manually)
4. **Target branch** must always be the feature branch, never main/master
