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

## Anti-Patterns to Avoid

1. **DON'T** skip the research phase
2. **DON'T** assume API behavior - verify with official docs
3. **DON'T** proceed without user approval on PLAN.md
4. **DON'T** write implementation code during planning
5. **DON'T** use unofficial documentation sources
6. **DON'T** make assumptions about ambiguous requirements

## Templates

- **Pre-Plan**: `.pi/prompts/pre-plan.md`
- **Plan**: `.pi/prompts/plan.md`
- **Feature Issue**: `.pi/prompts/issue-templates/feature.md`
- **Story Issue**: `.pi/prompts/issue-templates/story.md`
- **Task Issue**: `.pi/prompts/issue-templates/task.md`

## File Structure

```
.pi/
├── AGENTS.md                    # This file
├── extensions/
│   └── planning-orchestrator.ts # Workflow enforcement
├── agents/
│   ├── researcher.md            # Research agent
│   ├── planner.md               # Planning agent (primary)
│   └── organizer.md             # Organization agent
├── skills/
│   └── gh-cli/
│       └── SKILL.md              # GitHub CLI operations
├── prompts/
│   ├── pre-plan.md              # Pre-plan template
│   ├── plan.md                  # Plan template
│   └── issue-templates/
│       ├── feature.md
│       ├── story.md
│       └── task.md
└── settings.json                # Configuration
```

## Success Metrics

- ✅ Planner NEVER writes code
- ✅ Researcher uses only official docs
- ✅ User approval gate stops workflow at PLAN.md
- ✅ Organizer only runs after explicit approval
- ✅ No assumptions without user clarification
- ✅ Workflow cannot be skipped

## References

- [Pi Coding Agent](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent)
- [Extension Development](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent/docs/extensions.md)
- [Pi Skills](https://github.com/badlogic/pi-skills)
- [Agent Skills Standard](https://agentskills.io/specification)

---

**Enforcement**: This workflow is enforced by the `planning-orchestrator.ts` extension. Agents cannot bypass phases or skip user approval gates.
