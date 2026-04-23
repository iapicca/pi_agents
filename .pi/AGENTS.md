# Planning Workflow Configuration

## ⚠️ CRITICAL RULES - DO NOT VIOLATE

This project uses two complementary workflows:

1. **Planning Workflow**: RESEARCHER → PLANNER → ORGANIZER (planning only, no code)
2. **Coding Workflow**: CODER → IMPLEMENTATION PLANNER → CODER → PR-WRITER (implementation)

Both workflows are enforced by extensions and cannot be bypassed.

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

## Coding Workflow

A separate **coding workflow** implements approved GitHub issues through code using a **three-tier branch hierarchy**:

```
┌─────────────┐     ┌─────────────────────┐     ┌─────────────────────────────┐
│   USER      │────▶│       CODER         │────▶│   IMPLEMENTATION PLANNER    │
│ ISSUE URL   │     │    (Primary)        │     │    (level: feature)         │
└─────────────┘     └─────────────────────┘     └─────────────────────────────┘
                                                           │
                                                           ▼
                                               ┌─────────────────────────────┐
                                               │   IMPLEMENTATION PLANNER    │
                                               │    (level: story)           │
                                               │    (for each story)         │
                                               └─────────────────────────────┘
                                                           │
                                                           ▼
                                               ┌─────────────────────────────┐
                                               │   TASK ITERATION LOOP       │
                                               │    (for each task)          │
                                               └─────────────────────────────┘
                                                           │
     ┌─────────────────────────────────────────────────────┼───────────────────┐
     │                                                     │                   │
     ▼                                                     ▼                   ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  FEATURE    │     │   STORY     │     │    TASK     │  │   LINTER    │  │  PR-WRITER  │
│   BRANCH    │◄────│   BRANCH    │◄────│   BRANCH    │  │ (validate)  │  │ (Subagent)  │
│ feat/N-slug │     │story/N.M-slg│     │task/N.M.P-s │  └─────────────┘  └──────┬──────┘
└─────────────┘     └─────────────┘     └─────────────┘                          │
     ▲                     ▲                     │                                │
     │                     │                     │                                │
     │                     │                     └────────────────────────────────┘
     │                     │
     │                     └──── (story PR merged when last task completes)
     │
     └─────────────────────────── (feature branch reviewed by user before main merge)
```

### CODER Agent (Primary Entry Point)
- **Purpose**: Implement GitHub issues by orchestrating subagents and writing code
- **Trigger**: User provides a GitHub issue URL via `/code <url>`
- **Constraint**: NEVER operates on main/master - always uses feature branches
- **Iteration**: Processes tasks in semantic versioning order
- **Three-Tier Branching**: Creates feature → story → task branches
- **Context Loading**: Loads feat + story + task implementation files for each task

### IMPLEMENTATION PLANNER Agent (Subagent)
- **Purpose**: Analyze issues and codebase at feature, story, or task level
- **Constraint**: NEVER writes implementation code - analysis only
- **Levels**:
  - **Feature**: Architecture, cross-story interactions, story checklist → `feat-implementation-{N}.md`
  - **Story**: Strategy, cross-task interactions, task checklist → `story-implementation-{N.M}.md`
  - **Task**: Specific file/line changes → `task-implementation-{N.M.P}.md`
- **No-Duplication Rule**: Task plans reference (don't repeat) story/feature content

### PR-WRITER Agent (Subagent)
- **Purpose**: Commit code, push branch, create PR, merge automatically
- **Constraint**: Task PRs target story branches; Story PRs target feature branches; NEVER main/master
- **Output**: Merged PRs with "Fixes" links, checkboxes checked in parent plans, implementation files cleaned up

### Coding Workflow States

1. **IDLE** → User calls `/code <issue-url>`
2. **FETCHING_ISSUE** → Parse issue type (feature/story/task)
3. **PLANNING_FEATURE** → IMPLEMENTATION PLANNER creates feature architecture plan
4. **PLANNING_STORIES** → IMPLEMENTATION PLANNER creates story strategy plans (upfront)
5. **PLANNING_TASK** → IMPLEMENTATION PLANNER analyzes current codebase for task
6. **CODING** → CODER loads all 3 impl files and writes/edits code
7. **LINTING** → Run first-party linter, fix errors
8. **CREATING_PR** → PR-WRITER creates task→story PR or story→feature PR, merges
9. **COMPLETE_TASK** → Task done, clean implementation file, proceed to next task
10. **COMPLETE_ALL** → All stories and tasks finished

### Issue Type Handling

| Issue Type | Action | Iteration |
|------------|--------|-----------|
| **Task** | Process directly | Single task |
| **Story** | Find child tasks | Iterate each task in semver order |
| **Feature** | Find child stories → find their tasks | Iterate each task globally in semver order |

### Branch Strategy

- **Feature branch**: `feat/<issue_number>-<slug>` (created from main/master)
- **Story branch**: `story/<feature_number>.<minor>-<slug>` (created from feature branch)
- **Task branch**: `task/<feature_number>.<minor>.<patch>-<slug>` (created from story branch)
- **Task PR target**: Story branch (never main/master or feature branch)
- **Story PR target**: Feature branch (never main/master)
- **User review**: Manual merge of feature branch to main/master when ready

### Semantic Versioning for Task Order

Tasks are processed in ascending semantic version order:
- `[1.1.1]` → `[1.1.2]` → `[1.1.3]` → `[1.2.1]` → `[2.1.1]`

### PR Template Rules

**Task PRs** (task → story) MUST include:
- `Fixes https://github.com/<owner>/<repo>/issues/<task_number>`
- Target: story branch
- Template: `.pi/prompts/pr-templates/task.md`

**Story PRs** (story → feature) MUST include:
- `Fixes https://github.com/<owner>/<repo>/issues/<story_number>`
- Target: feature branch
- Template: `.pi/prompts/pr-templates/story.md`
- Only created after the last task of the story is merged

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

---

### Start Coding an Issue

```
/code https://github.com/owner/repo/issues/42
```

### Check Coding Status

```
/code-status
```

### Emergency Reset Coding Workflow

```
/reset-code
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

### Planning Workflow
The following execute WITHOUT confirmation:
- `gh_issue_create`
- `gh_issue_list`
- `gh_issue_view`
- `gh_api`
- `gh_repo_view`
- `gh_remote_url`

### Coding Workflow
The following execute WITHOUT confirmation:
- `gh_issue_view`
- `gh_issue_list`
- `gh_pr_create`
- `gh_pr_merge`
- `gh_pr_view`
- `gh_api`
- `gh_repo_view`
- `git checkout -b`
- `git checkout`
- `git branch`
- `git add`
- `git commit`
- `git push`
- `git status`
- `git log`
- `git diff`
- `git remote`
- `git merge`
- `git rebase`
- First-party linter commands (`npm run lint`, `cargo clippy`, `ruff check`, etc.)

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
- Allowed: `read`, `gh_issue_create`, `gh_issue_list`, `gh_issue_view`, `gh_repo_view`, `gh_api`
- Pre-granted: All `gh_*` extension tools

### PLANNING_FEATURE Phase (Coding Workflow)
- Allowed: `read`, `grep`, `find`, `ls`, `bash` (read-only), `webfetch`, `ask_user`, `subagent`
- **FORBIDDEN**: `write`, `edit` (NEVER write code)
- Output: `feat-implementation-{N}.md`

### PLANNING_STORIES Phase (Coding Workflow)
- Allowed: `read`, `grep`, `find`, `ls`, `bash` (read-only), `webfetch`, `ask_user`, `subagent`
- **FORBIDDEN**: `write`, `edit` (NEVER write code)
- Output: `story-implementation-{N.M}.md` (one per story)

### PLANNING_TASK Phase (Coding Workflow)
- Allowed: `read`, `grep`, `find`, `ls`, `bash` (read-only), `webfetch`, `ask_user`, `subagent`
- **FORBIDDEN**: `write`, `edit` (NEVER write code)
- Output: `task-implementation-{N.M.P}.md`

### CODING Phase
- Allowed: `read`, `grep`, `find`, `ls`, `bash`, `subagent`, `write`, `edit`
- **FORBIDDEN**: Operating on `main`/`master` branch
- Must load all 3 implementation files before coding
- Must run linter before invoking PR-WRITER
- Must not introduce new dependencies (unless stated in issue)

### PR-CREATION Phase
- Allowed: `read`, `bash` (git commands only), `gh_pr_create`, `gh_pr_merge`, `gh_pr_view`
- Pre-granted: `git add`, `git commit`, `git push`, `gh_pr_create`, `gh_pr_merge`
- Task PRs must target story branch, never main/master or feature branch
- Story PRs must target feature branch, never main/master

## Template Files

All agent outputs follow structured templates:

### Planning Workflow Templates
- **Pre-Plan**: `.pi/prompts/pre-plan.md` - RESEARCHER output
- **Plan**: `.pi/prompts/plan.md` - PLANNER output

### Issue Templates
- **Feature Issue**: `.pi/prompts/issue-templates/feature.md` - GitHub feature template
- **Story Issue**: `.pi/prompts/issue-templates/story.md` - GitHub story template
- **Task Issue**: `.pi/prompts/issue-templates/task.md` - GitHub task template

### Implementation Plan Templates (Coding Workflow)
- **Feature Plan**: `.pi/prompts/impl-templates/feature.md` - Feature architecture template
- **Story Plan**: `.pi/prompts/impl-templates/story.md` - Story strategy template
- **Task Plan**: `.pi/prompts/impl-templates/task.md` - Task implementation template

### PR Templates (Coding Workflow)
- **Task PR**: `.pi/prompts/pr-templates/task.md` - Task → Story PR template
- **Story PR**: `.pi/prompts/pr-templates/story.md` - Story → Feature PR template

## File Structure

```
.pi/
├── AGENTS.md                    # This file - global workflow instructions
├── extensions/
│   ├── planning-orchestrator.ts # Planning workflow enforcement
│   ├── coding-orchestrator.ts   # Coding workflow enforcement
│   └── gh-extension.ts          # Structured GitHub CLI tools
├── agents/                       # Agent definitions (project-local copy)
│   ├── researcher.md            # Research agent (planning)
│   ├── planner.md               # Planning agent (primary)
│   ├── organizer.md             # Organization agent
│   ├── coder.md                 # Coding agent (primary)
│   ├── implementation-planner.md # Implementation planning agent (3 levels)
│   └── pr-writer.md             # PR creation agent (task + story PRs)
├── prompts/
│   ├── agents/                  # Agent system prompts
│   │   ├── researcher.md
│   │   ├── planner.md
│   │   ├── organizer.md
│   │   ├── coder.md
│   │   ├── implementation-planner.md
│   │   └── pr-writer.md
│   ├── pre-plan.md              # Pre-plan template
│   ├── plan.md                  # Plan template
│   ├── impl-templates/          # Implementation plan templates
│   │   ├── feature.md           # Feature architecture template
│   │   ├── story.md             # Story strategy template
│   │   └── task.md              # Task implementation template
│   ├── pr-templates/            # PR templates
│   │   ├── task.md              # Task → Story PR template
│   │   └── story.md             # Story → Feature PR template
│   ├── issue-templates/         # Issue templates
│   │   ├── feature.md           # Feature issue template
│   │   ├── story.md             # Story issue template
│   │   └── task.md              # Task issue template
│   └── extensions/              # Orchestrator phase prompt files
│       ├── planning-orchestrator/
│       │   ├── researcher-phase.md
│       │   ├── planner-phase.md
│       │   └── organizer-phase.md
│       └── coding-orchestrator/
│           ├── planning-feature-phase.md
│           ├── planning-stories-phase.md
│           ├── planning-task-phase.md
│           ├── coding-phase.md
│           ├── creating-pr-task-phase.md
│           └── creating-pr-story-phase.md
└── settings.json                # Configuration
```

## Agent Installation

Agent definitions exist in **two locations** so the `subagent` extension can discover them:

1. **Project-local**: `.pi/agents/*.md` — version-controlled with your repo
2. **Global**: `~/.pi/agent/agents/*.md` — required because the `subagent` tool defaults to `agentScope: "user"` (global-only)

All agent invocations in this workflow explicitly pass `agentScope: "both"` so agents are found regardless of which location they are installed in. However, the installer copies them to the global directory to ensure compatibility.

### Agent Definitions

| Agent | Role | Scope |
|-------|------|-------|
| `researcher` | Verifies official documentation | Planning workflow |
| `planner` | Generates PLAN.md | Planning workflow (primary) |
| `organizer` | Creates GitHub issues from plan | Planning workflow |
| `coder` | Implements issues via code | Coding workflow (primary) |
| `implementation-planner` | Analyzes codebase, writes impl plans | Coding workflow (3 levels) |
| `pr-writer` | Commits, creates PRs, merges | Coding workflow |

## State Machine Enforcement

This workflow is enforced by the `planning-orchestrator.ts` extension. Agents cannot bypass phases or skip user approval gates.

### Enforcement Mechanisms

1. **State Machine**: 
   - Planning: `IDLE` → `RESEARCHING` → `PLANNING` → `PENDING_APPROVAL` → `ORGANIZING` → `COMPLETE`
   - Coding: `IDLE` → `FETCHING_ISSUE` → `PLANNING_FEATURE` → `PLANNING_STORIES` → `PLANNING_TASK` → `CODING` → `LINTING` → `CREATING_PR` → `COMPLETE_TASK` → `COMPLETE_ALL`
2. **User Gates**: Hard stops requiring explicit user confirmation before phase transitions (planning only)
3. **Pre-granted Permissions**: Allows specific bash commands (gh issue create, gh issue list, git, gh pr) without asking
4. **Ambiguity Detection**: Prompts user when planner detects unclear requirements
5. **Tool Filtering**: Extension blocks unauthorized tool usage (e.g., `write`/`edit` in PLANNING phases)

## Anti-Patterns to Avoid

1. **DON'T** skip the research phase
2. **DON'T** assume API behavior - verify with official docs
3. **DON'T** proceed without user approval on PLAN.md
4. **DON'T** write implementation code during planning
5. **DON'T** use unofficial documentation sources
6. **DON'T** make assumptions about ambiguous requirements

## Success Metrics

### Planning Workflow
- ✅ Planner NEVER writes code
- ✅ Researcher uses only official docs
- ✅ User approval gate stops workflow at PLAN.md
- ✅ Organizer only runs after explicit approval
- ✅ Issues follow Semantic Versioning with version numbers in titles (e.g., `[1] Feat`, `[1.5] Story`, `[1.5.3] Task`)
- ✅ No assumptions without user clarification
- ✅ Workflow cannot be skipped

### Coding Workflow
- ✅ CODER NEVER operates on main/master
- ✅ IMPLEMENTATION PLANNER NEVER writes code
- ✅ Feature and story plans created upfront; task plans created iteratively
- ✅ No duplication across feat/story/task implementation plans
- ✅ CODER loads all 3 implementation files (feat + story + task) for context
- ✅ Three-tier branching: feat/ → story/ → task/
- ✅ Task PRs target story branches; Story PRs target feature branches
- ✅ Linter passes before every PR
- ✅ No new dependencies introduced (unless stated in issue)
- ✅ PRs include "Fixes" link to relevant issue
- ✅ Tasks processed in semantic versioning order
- ✅ Granular cleanup: only completed implementation files are deleted
- ✅ Parent plan checkboxes updated when child PRs merge
- ✅ Feature branch reviewed by user before merging to main

## References

- [Pi Coding Agent](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent)
- [Extension Development](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent/docs/extensions.md)
- [Pi Skills](https://github.com/badlogic/pi-skills)
- [Agent Skills Standard](https://agentskills.io/specification)
- [Semantic Versioning](https://semver.org/)

---

**Enforcement**: The planning workflow is enforced by `planning-orchestrator.ts`. The coding workflow is enforced by `coding-orchestrator.ts`. Agents cannot bypass phases or skip user approval gates.
