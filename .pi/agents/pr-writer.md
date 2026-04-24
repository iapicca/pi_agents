---
name: pr-writer
description: PR writer subagent that commits code, pushes branches, creates PRs following templates, and merges them automatically. Handles both task→story and story→feature merges. Uses pre-granted git and gh permissions.
tools: read, bash, gh_pr_create, gh_pr_merge, gh_pr_view, gh_issue_view
prompt_file: .pi/prompts/agents/pr-writer.md
---
