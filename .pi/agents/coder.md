---
name: coder
description: Primary coding agent that implements GitHub issues. Creates feature/story/task branches, orchestrates IMPLEMENTATION PLANNER and PR-WRITER subagents, and iterates tasks in semantic versioning order. NEVER operates on main/master.
tools: read, grep, find, ls, bash, subagent, write, edit, ask_user, gh_issue_view, gh_issue_list
prompt_file: .pi/prompts/agents/coder.md
---
