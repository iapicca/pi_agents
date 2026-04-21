# Planning Workflow Configuration

## ⚠️ CRITICAL RULES - DO NOT VIOLATE

This project uses a **strict planning-only workflow** with three agents: RESEARCHER → PLANNER → ORGANIZER.

### Core Constraints (ABSOLUTE)

1. **NEVER write implementation code** - Planning documentation only
2. **ALWAYS use the planning workflow** for any new feature, bug fix, or refactoring
3. **MUST ask user for clarification** on ambiguous requirements - making assumptions is forbidden
4. **Use ONLY official documentation** - Reject Medium, StackOverflow, dev.to, and non-authoritative sources

## Three-Agent Workflow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   USER      │────▶│  RESEARCHER │────▶│   PLANNER   │────▶│  ORGANIZER  │
│  REQUEST    │     │  (Subagent) │     │  (Primary)  │     │  (Subagent) │
└─────────────┘     └─────────────┘     └──────┬──────┘     └─────────────┘
                                               │
                                               ▼
                                        ┌─────────────┐
                                        │  USER       │
                                        │  APPROVAL   │
                                        │  GATE       │
                                        └─────────────┘
```

### RESEARCHER Agent
- **Purpose**: Rigorously vet all external documentation
- **Sources**: ONLY official docs (API docs, GitHub repos, READMEs)
- **Output**: `.tmp/pre-plan.md` with verified tech stack and API requirements

### PLANNER Agent (Primary Entry Point)
- **Purpose**: Generate detailed implementation plan
- **Constraint**: NEVER writes code
- **Ambiguity**: MUST ask user for clarification
- **Output**: `.tmp/PLAN.md` with step-by-step implementation guide

### ORGANIZER Agent
- **Purpose**: Convert approved plan to GitHub issues
- **Trigger**: ONLY runs after explicit user approval
- **Output**: Hierarchical GitHub issues (Feature → Story → Task)

## Workflow States

1. **IDLE** → User calls `/plan <request>`
2. **RESEARCHING** → RESEARCHER verifies documentation
3. **PLANNING** → PLANNER generates PLAN.md
4. **PENDING_APPROVAL** → **HARD STOP** - User must approve
5. **ORGANIZING** → ORGANIZER creates GitHub issues
6. **COMPLETE** → Workflow finished

## Semantic Versioning for Issues

All GitHub issues MUST include semantic version numbers in titles (https://semver.org/):

| Issue Type | Version Level | Title Format | Example |
|------------|---------------|--------------|---------|
| **Feature** | MAJOR (X.0.0) | `[{N}] Feat - {title}` | `[1] Feat - Add user authentication` |
| **Story** | MINOR (x.Y.0) | `[{N.M}] Story - {title}` | `[1.5] Story - Implement OAuth login` |
| **Task** | PATCH (x.y.Z) | `[{N.M.P}] Task - {title}` | `[1.5.3] Task - Create OAuth callback` |

### Version Number Rules

- **Features**: Sequential whole numbers: `[1]`, `[2]`, `[3]`, etc.
- **Stories**: `{feature}.{story_number}` format: `[1.1]`, `[1.2]`, `[2.1]`, etc.
- **Tasks**: `{feature}.{story}.{task_number}` format: `[1.1.1]`, `[1.1.2]`, `[1.2.1]`, etc.

### Issue Hierarchy with Version Numbers

```
[1] Feat - Add User Authentication
  ├── [1.1] Story - Implement OAuth with GitHub
  │     ├── [1.1.1] Task - Create OAuth callback handler
  │     ├── [1.1.2] Task - Store user tokens securely
  │     └── [1.1.3] Task - Handle OAuth errors
  ├── [1.2] Story - Implement session management
  │     ├── [1.2.1] Task - Create session middleware
  │     └── [1.2.2] Task - Configure session store
  └── [1.3] Story - Add logout functionality

[2] Feat - Add User Profile Management
  └── [2.1] Story - Create profile page
        └── [2.1.1] Task - Build profile UI components
```

## Usage

### Start a New Plan

```
/plan "Add OAuth authentication with GitHub"
```

### Approve a Plan

After reviewing `.tmp/PLAN.md`:

```
/approve_plan approved=true
```

### Request Plan Changes

```
/approve_plan approved=false feedback="Add more detail about token storage"
```

### Check Status

```
/plan-status
```

### Emergency Reset

```
/reset-plan
```

## Documentation Sources (ALLOWED)

✅ **Use These:**
- Official API documentation (api.github.com/docs, docs.anthropic.com, etc.)
- Official package READMEs on GitHub
- Vendor documentation sites
- RFCs and specifications
- Academic papers

❌ **NEVER Use These:**
- Medium articles
- StackOverflow answers
- dev.to or Hashnode posts
- Personal blogs
- YouTube transcripts
- Unverified GitHub gists

## Pre-Granted Permissions

The following execute WITHOUT confirmation:
- `gh issue create`
- `gh issue list`
- `gh issue view`
- `gh api`
- `gh repo view`
- `git remote get-url origin`

All other commands require explicit user approval.

## Tool Restrictions by Phase

### RESEARCHING Phase
- Allowed: `read`, `grep`, `find`, `ls`, `bash` (read-only), `webfetch`
- Can ask user for documentation links via `ask_user`

### PLANNING Phase
- Allowed: `read`, `grep`, `find`, `ls`, `bash` (read-only), `ask_user`, `subagent`
- **FORBIDDEN**: `write`, `edit` (NEVER write code)
- Must resolve ambiguities with `ask_user` tool

### ORGANIZING Phase
- Allowed: `read`, `bash` (gh-cli commands only)
- Pre-granted: All `gh issue *` commands

## Template Files

All agent outputs follow structured templates:

- **Pre-Plan**: `.pi/prompts/pre-plan.md` - RESEARCHER output
- **Plan**: `.pi/prompts/plan.md` - PLANNER output
- **Feature Issue**: `.pi/prompts/issue-templates/feature.md` - GitHub feature template
- **Story Issue**: `.pi/prompts/issue-templates/story.md` - GitHub story template
- **Task Issue**: `.pi/prompts/issue-templates/task.md` - GitHub task template

## File Structure

```
.pi/
├── AGENTS.md                    # This file - global workflow instructions
├── extensions/
│   └── planning-orchestrator.ts # Workflow enforcement + permission gates
├── agents/                       # Agent definitions (used by subagent tool)
│   ├── researcher.md            # Research agent
│   ├── planner.md               # Planning agent (primary)
│   └── organizer.md             # Organization agent
├── skills/
│   └── gh-cli/
│       └── SKILL.md             # GitHub CLI operations
├── prompts/
│   ├── pre-plan.md              # Pre-plan template
│   ├── plan.md                  # Plan template
│   └── issue-templates/
│       ├── feature.md           # Feature issue template
│       ├── story.md             # Story issue template
│       └── task.md              # Task issue template
└── settings.json                # Configuration
```

## State Machine Enforcement

This workflow is enforced by the `planning-orchestrator.ts` extension. Agents cannot bypass phases or skip user approval gates.

### Enforcement Mechanisms

1. **State Machine**: Tracks workflow phase (`IDLE` → `RESEARCHING` → `PLANNING` → `PENDING_APPROVAL` → `ORGANIZING` → `COMPLETE`)
2. **User Gates**: Hard stops requiring explicit user confirmation before phase transitions
3. **Pre-granted Permissions**: Allows specific bash commands (gh issue create, gh issue list) without asking
4. **Ambiguity Detection**: Prompts user when planner detects unclear requirements
5. **Tool Filtering**: Extension blocks unauthorized tool usage (e.g., `write`/`edit` in PLANNING phase)

## Anti-Patterns to Avoid

1. **DON'T** skip the research phase
2. **DON'T** assume API behavior - verify with official docs
3. **DON'T** proceed without user approval on PLAN.md
4. **DON'T** write implementation code during planning
5. **DON'T** use unofficial documentation sources
6. **DON'T** make assumptions about ambiguous requirements

## Success Metrics

- ✅ Planner NEVER writes code
- ✅ Researcher uses only official docs
- ✅ User approval gate stops workflow at PLAN.md
- ✅ Organizer only runs after explicit approval
- ✅ Issues follow Semantic Versioning with version numbers in titles (e.g., `[1] Feat`, `[1.5] Story`, `[1.5.3] Task`)
- ✅ No assumptions without user clarification
- ✅ Workflow cannot be skipped

## References

- [Pi Coding Agent](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent)
- [Extension Development](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent/docs/extensions.md)
- [Pi Skills](https://github.com/badlogic/pi-skills)
- [Agent Skills Standard](https://agentskills.io/specification)
- [Semantic Versioning](https://semver.org/)

---

**Enforcement**: This workflow is enforced by the `planning-orchestrator.ts` extension. Agents cannot bypass phases or skip user approval gates.
