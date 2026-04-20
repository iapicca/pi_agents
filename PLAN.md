# Implementation Plan: Pi Planning Workflow System
## Overview
This document outlines the implementation of a **strict, planning-only workflow system** for [Pi](https://pi.dev) that enforces a three-agent architecture: **RESEARCHER → PLANNER → ORGANIZER**. The system is designed to prevent the "drift" problems encountered with OpenCode by using Pi's extension system to enforce workflow constraints at the tool level.
## Target Architecture
.pi/
├── AGENTS.md                          # Global workflow instructions
├── extensions/
│   └── planning-orchestrator.ts       # Workflow enforcement + permission gates
├── agents/                             # Agent definitions (used by subagent tool)
│   ├── researcher.md                   # Pre-plan research agent
│   ├── planner.md                      # Plan generation agent
│   └── organizer.md                    # GitHub issue creation agent
├── skills/
│   └── gh-cli/                         # GitHub CLI skill (pre-granted approval)
│       └── SKILL.md
├── prompts/
│   ├── pre-plan.md                     # Pre-plan template
│   ├── plan.md                         # Plan template
│   └── issue-templates/
│       ├── feature.md
│       ├── story.md
│       └── task.md
└── settings.json                       # Enable extension + agents
## Reusable Components (Don't Reinvent)
Based on research of available Pi packages and examples:
| Component | Source | Purpose | Usage |
|-----------|--------|---------|-------|
| **brave-search** | [badlogic/pi-skills](https://github.com/badlogic/pi-skills/tree/main/brave-search) | Web search for documentation | Install as skill for RESEARCHER |
| **subagent** | [pi-mono examples](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent/examples/extensions/subagent) | Spawn isolated sub-agents | **Reference implementation** for our orchestrator |
| **plan-mode** | [pi-mono examples](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent/examples/extensions/plan-mode) | Read-only exploration mode | **Pattern reference** for phase gating |
**Decision**: The `subagent` extension provides the core infrastructure we need. We'll create a **custom orchestrator extension** that:
1. Wraps subagent invocation with workflow state management
2. Adds explicit user confirmation gates
3. Pre-grants bash permissions for specific gh-cli commands
---
## Phase 1: Core Extension Implementation
### 1.1 Planning Orchestrator Extension (`.pi/extensions/planning-orchestrator.ts`)
**Purpose**: Enforces the tight workflow loop with hard user-approval gates.
**Key Features**:
- **State Machine**: Tracks workflow phase (`IDLE` → `RESEARCHING` → `PLANNING` → `PENDING_APPROVAL` → `ORGANIZING` → `COMPLETE`)
- **User Gates**: Hard stops requiring explicit user confirmation before phase transitions
- **Pre-granted Permissions**: Allows specific bash commands (gh issue create, gh issue list) without asking
- **Ambiguity Detection**: Prompts user when planner detects unclear requirements
**Tools to Register**:
| Tool | Purpose |
|------|---------|
| `plan` | Entry point - starts the workflow with a user request |
| `approve_plan` | User approval gate - transitions from PLANNING to ORGANIZING |
| `ask_user` | Ambiguity resolution - blocks and asks for clarification |
**Documentation References**:
- [Pi Extension API](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent/docs/extensions.md)
- [Subagent Example](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent/examples/extensions/subagent/index.ts)
- [Permission Gate Example](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent/examples/extensions/permission-gate.ts)
### 1.2 Extension Event Handlers
Implement handlers for Pi's extension events:
| Event | Handler Purpose |
|-------|-----------------|
| `tool_call` | Filter bash commands - allow `gh issue *` and `gh api` without confirmation; block all other write operations |
| `before_agent_start` | Inject phase-specific context (e.g., "You are RESEARCHER phase - verify documentation") |
| `turn_end` | Track phase completion markers in agent output |
| `agent_end` | Transition state machine and prompt for user approval |
---
## Phase 2: Agent Definitions
### 2.1 RESEARCHER Agent (`.pi/agents/researcher.md`)
**Mode**: Subagent (invoked by orchestrator)
**Purpose**: Rigorously vet external documentation before planning
**System Prompt Requirements**:
- Must use **only** official documentation sources (API docs, GitHub repos, package READMEs)
- Explicitly **reject** Medium, StackOverflow, dev.to, and other non-authoritative sources
- Evaluate stack choices, API compatibility, and potential failure points
- Output structured `pre-plan.md` with:
  - Verified tech stack
  - API authentication requirements (verified against docs, not assumed)
  - Potential risks/blockers
  - Links to official documentation consulted
**Tools**: `read`, `grep`, `find`, `ls`, `bash` (for `webfetch` via brave-search skill)
**Documentation**:
- [Agent Definition Format](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent/examples/extensions/subagent/agents/scout.md)
- [Agent Frontmatter Schema](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent/examples/extensions/subagent/agents.ts)
### 2.2 PLANNER Agent (`.pi/agents/planner.md`)
**Mode**: Primary (single entry point)
**Purpose**: Generate detailed, implementation-ready PLAN.md
**Core Constraints**:
- **NEVER** writes code
- **MUST** ask user for clarification on ambiguous requirements (uses `ask_user` tool)
- Generates PLAN.md with:
  - Step-by-step implementation guide
  - API references (with official doc links from pre-plan)
  - Anti-patterns to avoid
  - Testing strategy
  - Rollback plan
**Tight Loop Enforcement**:
User Request → RESEARCHER (subagent) → PLANNER generates PLAN.md → HARD STOP → User Approval → ORGANIZER (subagent)
**Tools**: `read`, `grep`, `find`, `ls`, `ask_user` (custom tool from orchestrator), `subagent` (to invoke researcher)
### 2.3 ORGANIZER Agent (`.pi/agents/organizer.md`)
**Mode**: Subagent (invoked only after user approves PLAN.md)
**Purpose**: Translate PLAN.md into GitHub issues using gh-cli
**Pre-granted Permissions** (no confirmation required):
- `gh issue create`
- `gh issue list`
- `gh api` (for adding labels, milestones)
**Workflow**:
1. Parse PLAN.md for features, stories, tasks
2. Create hierarchical GitHub issues:
   - Features (parent) → Stories (parent) → Tasks (child)
3. Use templates from `.pi/prompts/issue-templates/`
**Tools**: `read`, `bash` (pre-filtered for gh-cli only)
---
## Phase 3: GitHub CLI Skill
### 3.1 gh-cli Skill (`.pi/skills/gh-cli/SKILL.md`)
**Purpose**: Encapsulate GitHub CLI usage with pre-granted execution approval
**Frontmatter**:
```yaml
---
name: gh-cli
description: Create and manage GitHub issues via gh CLI. Pre-approved for planning workflow.
---
Setup Instructions:
- Verify gh is installed and authenticated
- Provide issue template paths
Usage Examples:
# Create feature issue
gh issue create --title "[Feature] $title" --body "$body" --label "feature"
# Create story (child of feature)
gh issue create --title "[Story] $title" --body "$body" --label "story" --parent "$feature_issue_number"
# Create task (child of story)  
gh issue create --title "[Task] $title" --body "$body" --label "task" --parent "$story_issue_number"
---
Phase 4: Templates
4.1 Prompt Templates (.pi/prompts/)
Template	Purpose
pre-plan.md	Structure for RESEARCHER output (tech stack, API verification, risks)
plan.md	Structure for PLANNER output (implementation steps, anti-patterns, testing)
issue-templates/feature.md	GitHub issue template for features
issue-templates/story.md	GitHub issue template for stories
issue-templates/task.md	GitHub issue template for tasks
---
Phase 5: Configuration
5.1 AGENTS.md (Project Root)
Purpose: Global workflow instructions loaded at startup
Content Summary:
- This project uses a strict planning-only workflow
- Three agents: RESEARCHER → PLANNER → ORGANIZER
- Hard user-approval gates between phases
- No code generation - planning only
- Ambiguity must be resolved with user, never assumed
5.2 settings.json
Enable the orchestrator extension and configure agent discovery:
{
  "extensions": ["./.pi/extensions/planning-orchestrator.ts"],
  "skills": ["./.pi/skills/gh-cli"],
  "agentScope": "both"
}
---
## Implementation Steps
### Step 1: Extension Foundation
1. Create `.pi/extensions/planning-orchestrator.ts`
2. Implement state machine (IDLE → RESEARCHING → PLANNING → PENDING_APPROVAL → ORGANIZING → COMPLETE)
3. Register custom tools: `plan`, `approve_plan`, `ask_user`
4. Implement event handlers for tool_call filtering (pre-grant gh-cli commands)
### Step 2: Agent Definitions
1. Create `.pi/agents/planner.md` (primary agent)
2. Create `.pi/agents/researcher.md` (subagent)
3. Create `.pi/agents/organizer.md` (subagent)
4. Test subagent invocation via orchestrator
### Step 3: Skill Setup
1. Create `.pi/skills/gh-cli/SKILL.md`
2. Install brave-search skill: `git clone https://github.com/badlogic/pi-skills ~/.pi/agent/skills/pi-skills`
3. Configure gh-cli authentication
### Step 4: Templates
1. Create `.pi/prompts/pre-plan.md`
2. Create `.pi/prompts/plan.md`
3. Create `.pi/prompts/issue-templates/` (feature.md, story.md, task.md)
### Step 5: Configuration
1. Create `AGENTS.md` with global workflow instructions
2. Create `.pi/settings.json` to enable extension
3. Test full workflow: `/plan "Add user authentication"`
### Step 6: Testing & Refinement
1. Test ambiguity detection (planner should ask, not assume)
2. Test pre-granted permissions (gh commands should not prompt)
3. Test user approval gates (workflow should stop at PLAN.md)
4. Test drift prevention (attempt to skip researcher should fail)
---
Documentation References
Topic	Link
Pi Coding Agent	https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent (https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent)
Extension Development	https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent/docs/extensions.md (https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent/docs/extensions.md)
Skills Specification	https://agentskills.io/specification (https://agentskills.io/specification)
Subagent Example	https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent/examples/extensions/subagent (https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent/examples/extensions/subagent)
Plan Mode Example	https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent/examples/extensions/plan-mode (https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent/examples/extensions/plan-mode)
Permission Gate Example	https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent/examples/extensions/permission-gate.ts (https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent/examples/extensions/permission-gate.ts)
Pi Skills Repository	https://github.com/badlogic/pi-skills (https://github.com/badlogic/pi-skills)
Pi Packages Registry	https://pi.dev/packages (https://pi.dev/packages)
---
## Success Criteria
- [ ] Planner NEVER writes code - only generates PLAN.md
- [ ] RESEARCHER uses only official documentation (rejects Medium/StackOverflow)
- [ ] User approval gate stops workflow at PLAN.md phase
- [ ] ORGANIZER only runs after explicit user approval
- [ ] Pre-granted gh-cli commands execute without confirmation prompts
- [ ] Ambiguous requirements trigger user clarification prompts
- [ ] Workflow cannot be skipped (enforced by state machine)
- [ ] Agents cannot drift from defined behavior (enforced by extension)
---
Anti-Goals (Explicitly Avoided)
- Code generation (out of scope)
- Automatic PR creation (out of scope)
- Unsupervised agent execution (prevented by design)
- Trusting unofficial documentation (prevented by researcher instructions)
- Allowing agents to make assumptions (prevented by ambiguity detection)