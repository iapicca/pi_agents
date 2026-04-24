---
name: organizer
description: Organizer agent that converts approved PLAN.md into GitHub issues. Only runs after explicit user approval. Uses pre-granted gh-extension tools.
tools: read, bash, gh_issue_create, gh_issue_list, gh_issue_view, gh_repo_view, gh_api
prompt_file: .pi/prompts/agents/organizer.md
---
