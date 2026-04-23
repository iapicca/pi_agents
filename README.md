# Pi Agents

AI-driven planning and coding workflows for software projects using [Pi](https://pi.dev).

This repository provides a rigorously enforced two-phase development process:

1. **Planning Workflow** — Research, plan, and break down work into semantically-versioned GitHub issues
2. **Coding Workflow** — Implement approved issues through a three-tier branch hierarchy with automated PRs

Both workflows use **mechanical enforcement** (`pi.setActiveTools()`) to ensure agents never bypass phases or perform unauthorized actions.

---

## Quick Start

### Planning

```bash
# Start planning a new feature
/plan "Add OAuth authentication with GitHub"

# The extension will:
# 1. Spawn RESEARCHER subagent → verifies official docs → writes .tmp/pre-plan.md
# 2. Transition to PLANNING → you read pre-plan, ask clarifying questions, write .tmp/PLAN.md
# 3. Call submit_plan → workflow halts at PENDING_APPROVAL

# After reviewing .tmp/PLAN.md, approve it:
/approve-plan

# Or request changes:
/approve-plan Add more detail about token storage and session expiry

# The extension spawns ORGANIZER subagent → creates GitHub issues
```

### Coding

```bash
# Implement an approved GitHub issue
/code https://github.com/owner/repo/issues/42

# The extension will:
# 1. Fetch issue details, determine type (feature/story/task)
# 2. Create feature branch: feat/42-add-oauth
# 3. Create story branches: story/42.1-implement-github, etc.
# 4. Spawn IMPLEMENTATION PLANNER (feature level) → .tmp/feat-implementation-42.md
# 5. Spawn IMPLEMENTATION PLANNER for each story → .tmp/story-implementation-42.X.md
# 6. For each task (in semver order):
#    a. Spawn task-level IMPLEMENTATION PLANNER → .tmp/task-implementation-42.X.Y.md
#    b. You (CODER) load all 3 impl files, write code, run linter
#    c. Call complete_coding → extension spawns PR-WRITER → merges task PR to story branch
# 7. After last task of each story: extension spawns PR-WRITER → merges story PR to feature branch
# 8. All done → feature branch ready for your review
```

---

## Planning Workflow: RESEARCHER → PLANNER → [APPROVAL] → ORGANIZER

```
User: /plan "Add OAuth"
  │
  ▼
Extension: state = RESEARCHING
  │
  ▼
RESEARCHER subagent (auto-spawned)
  → Verifies official documentation
  → Writes .tmp/pre-plan.md
  → Exits
  │
  ▼
Extension: state = PLANNING
  │
  ▼
PLANNER (main session)
  → Reads .tmp/pre-plan.md
  → Uses ask_user tool for clarifications
  → Writes .tmp/PLAN.md
  → Calls submit_plan tool
  │
  ▼
Extension: state = PENDING_APPROVAL
  │
  ▼
User: /approve-plan
  │
  ▼
Extension: state = ORGANIZING
  │
  ▼
ORGANIZER subagent (auto-spawned)
  → Creates GitHub issues with semantic versioning
  → Exits
  │
  ▼
Extension: state = COMPLETE
```

### Semantic Versioning for Issues

| Issue Type | Version Level | Title Format | Example |
|------------|---------------|--------------|---------|
| **Feature** | MAJOR (X.0.0) | `[{N}] Feat - {title}` | `[1] Feat - Add user authentication` |
| **Story** | MINOR (x.Y.0) | `[{N.M}] Story - {title}` | `[1.5] Story - Implement OAuth login` |
| **Task** | PATCH (x.y.Z) | `[{N.M.P}] Task - {title}` | `[1.5.3] Task - Create OAuth callback` |

---

## Coding Workflow: Three-Tier Branch Hierarchy

```
main
└── feat/42-add-oauth
    ├── story/42.1-implement-github
    │   ├── task/42.1.1-create-callback  → PR merged → story/42.1
    │   └── task/42.1.2-store-tokens     → PR merged → story/42.1
    │                                      → story PR merged → feat/42
    └── story/42.2-session-management
        └── task/42.2.1-create-middleware  → PR merged → story/42.2
                                             → story PR merged → feat/42
```

### Iteration Flow

```
Extension: state = PLANNING_TASK
  │
  ▼
IMPLEMENTATION PLANNER subagent (auto-spawned)
  → Analyzes codebase for current task
  → Writes .tmp/task-implementation-42.X.Y.md
  → Exits
  │
  ▼
Extension: state = CODING
  │
  ▼
CODER (main session)
  → Loads feat + story + task impl files
  → Writes/edits code
  → Runs linter (fix until pass)
  → Calls complete_coding tool
  │
  ▼
Extension: state = CREATING_PR
  │
  ▼
PR-WRITER subagent (auto-spawned)
  → Commits, pushes, creates PR, merges
  → Exits
  │
  ▼
Extension: state = COMPLETE_TASK
  → If more tasks in same story: PLANNING_TASK (loop)
  → If last task of story: CREATING_PR (story → feature)
  → If all tasks done: COMPLETE_ALL
```

---

## Commands Reference

| Command | Workflow | Description |
|---------|----------|-------------|
| `/plan "<request>"` | Planning | Start planning workflow |
| `/approve-plan` | Planning | Approve the generated PLAN.md |
| `/approve-plan <feedback>` | Planning | Reject plan with feedback for revision |
| `/plan-status` | Planning | Show current planning status |
| `/reset-plan` | Planning | Emergency reset to IDLE |
| `/code <issue-url>` | Coding | Start coding workflow |
| `/code-status` | Coding | Show current coding status |
| `/reset-code` | Coding | Emergency reset to IDLE |

---

## Enforcement

This is not "hope the LLM follows instructions." Enforcement is **mechanical**:

1. **`pi.setActiveTools()`** — At every state transition, the extension removes forbidden tools from the LLM's system prompt. If `write` is not in the active tools list, the LLM literally cannot call it.

2. **`pi.on("tool_call")` blocking** — A runtime handler catches any attempts that slip through:
   - `write`/`edit` outside `.tmp/` is blocked during planning phases
   - `git checkout/merge/rebase main|master` is blocked during coding

3. **`before_agent_start` injection** — Phase-specific constraint reminders are injected into the LLM's context window before each turn.

4. **Extension-driven subagents** — The extension invokes subagents directly. The main-session LLM does not decide when to spawn RESEARCHER, ORGANIZER, IMPLEMENTATION PLANNER, or PR-WRITER.

---

## Configuration

Extensions are loaded from `.pi/settings.json`:

```json
{
  "extensions": [
    "./.pi/extensions/subagent/index.ts",
    "./.pi/extensions/planning-orchestrator.ts",
    "./.pi/extensions/coding-orchestrator.ts",
    "./.pi/extensions/gh-extension.ts"
  ],
  "enableSkillCommands": true
}
```

Agent definitions live in `.pi/agents/` and `.pi/prompts/agents/`. The `subagent` extension discovers them automatically.

---

## Project Structure

```
.pi/
├── AGENTS.md                    # Global workflow instructions
├── extensions/
│   ├── planning-orchestrator.ts # Planning workflow enforcement
│   ├── coding-orchestrator.ts   # Coding workflow enforcement
│   ├── gh-extension.ts          # Structured GitHub CLI tools
│   └── subagent/index.ts        # Subagent spawning
├── agents/                       # Agent definitions
│   ├── researcher.md
│   ├── planner.md
│   ├── organizer.md
│   ├── coder.md
│   ├── implementation-planner.md
│   └── pr-writer.md
├── prompts/
│   ├── agents/                  # Agent system prompts
│   ├── pre-plan.md              # Pre-plan template
│   ├── plan.md                  # Plan template
│   ├── impl-templates/          # Implementation plan templates
│   ├── pr-templates/            # PR templates
│   ├── issue-templates/         # Issue templates
│   └── extensions/              # Orchestrator phase prompts
└── settings.json                # Configuration
```

---

## Example Session

```bash
# PLANNING PHASE
/plan "Add OAuth authentication with GitHub"
# ... wait for RESEARCHER and PLANNER ...
# Review .tmp/PLAN.md
/approve-plan
# ... wait for ORGANIZER ...
# GitHub issues created: [1] Feat - Add OAuth, [1.1] Story - Implement GitHub OAuth, etc.

# CODING PHASE
/code https://github.com/owner/repo/issues/42
# ... extension creates branches, spawns planners ...
# You are now in CODING phase for task [1.1.1]
# Load .tmp/feat-implementation-42.md
# Load .tmp/story-implementation-42.1.md
# Load .tmp/task-implementation-42.1.1.md
# Write code, run linter, call complete_coding
# ... extension creates PR, merges, advances to next task ...
# Repeat until all tasks complete

# FINAL REVIEW
# Feature branch feat/42-add-oauth is ready
# Merge to main when satisfied
```

---

## References

- [Pi Coding Agent](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent)
- [Extension Development](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent/docs/extensions.md)
- [Semantic Versioning](https://semver.org/)
