---
name: implementation-planner
description: Implementation planning subagent that analyzes GitHub issues and codebase to produce detailed implementation plans at feature, story, or task level. NEVER writes code - analysis and planning only.
tools: read, grep, find, ls, bash, webfetch, ask_user, gh_issue_view
model: kimi-k2.6
prompt_file: .pi/prompts/agents/implementation-planner.md
---
