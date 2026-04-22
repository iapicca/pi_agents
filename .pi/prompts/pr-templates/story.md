# Story PR Template

Use this template when creating Pull Requests for story → feature merges from the PR-WRITER agent.

```markdown
## Related Issues
Fixes https://github.com/{{OWNER}}/{{REPO}}/issues/{{STORY_NUMBER}}

## Summary
Story [{{STORY_VERSION}}] {{STORY_TITLE}} has been fully implemented.

## Completed Tasks
{{COMPLETED_TASKS_LIST}}

## Changes
{{LIST_OF_CHANGES}}

## Checklist
- [x] All tasks in story completed and merged
- [x] Code follows project style guidelines
- [x] Linter passes
- [x] Story acceptance criteria met
- [x] No new dependencies introduced (unless specified in issue)

## Reference
- **Story:** #{{STORY_NUMBER}}
- **Feature:** #{{FEATURE_NUMBER}}
```

## Usage Notes

### For PR-WRITER Agent

1. Replace all `{{VARIABLES}}` with actual values before creating the PR
2. List all completed tasks in the story
3. The "Fixes" link ensures the related story issue will be closed when the feature branch is eventually merged

### Variable Definitions

- `{{STORY_NUMBER}}` - The GitHub issue number of the story
- `{{STORY_TITLE}}` - The title of the story issue
- `{{STORY_VERSION}}` - Semantic version of the story (e.g., `1.1`, `1.2`)
- `{{FEATURE_NUMBER}}` - The parent feature issue number
- `{{OWNER}}` - GitHub repository owner/organization
- `{{REPO}}` - GitHub repository name
- `{{COMPLETED_TASKS_LIST}}` - List of all completed tasks in this story with their PRs
- `{{LIST_OF_CHANGES}}` - Summary of all changes across tasks in this story

### Important Rules

1. **Always include** the story's "Fixes" link
2. **Target branch** must always be the feature branch, never main/master
3. Story PRs are auto-merged to the feature branch
4. Only create story PRs after the last task of the story has been merged
