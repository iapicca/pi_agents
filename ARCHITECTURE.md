# Pi Planning Workflow System - Architecture
## Vision
A **drift-resistant, planning-only workflow system** for Pi that enforces a strict three-agent methodology. The system treats planning as a first-class concern, with hard enforcement of workflow phases, mandatory user approval gates, and rigorous documentation verification.
---
## Core Features
### 1. Three-Agent Tight Loop
The system implements a **strictly sequential** three-agent workflow that cannot be bypassed:
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
#### RESEARCHER Agent
- **Purpose**: Rigorously vet all external documentation before planning begins
- **Constraint**: Uses **only** official documentation sources (API docs, GitHub repos, package READMEs)
- **Anti-Pattern Prevention**: Explicitly rejects Medium articles, StackOverflow answers, dev.to posts, and other non-authoritative sources
- **Output**: `pre-plan.md` containing verified tech stack, authenticated API requirements (verified, not assumed), and documented risks
#### PLANNER Agent
- **Purpose**: Generate implementation-ready plans without writing code
- **Constraint**: **NEVER** writes implementation code
- **Ambiguity Handling**: Must ask the user for clarification on unclear requirements—making assumptions is strictly prohibited
- **Output**: `PLAN.md` with step-by-step implementation guide, official API references, anti-patterns to avoid, testing strategy, and rollback procedures
#### ORGANIZER Agent
- **Purpose**: Convert approved plans into actionable GitHub issues
- **Constraint**: Only executes after explicit user approval of PLAN.md
- **Hierarchy**: Creates properly nested issues (Features → Stories → Tasks)
- **Tool**: Pre-approved GitHub CLI operations without confirmation prompts
---
### 2. Workflow Enforcement via Extension
Unlike OpenCode's instruction-based approach (which agents can ignore), this system uses **Pi's extension API** to enforce workflow at the tool level:
#### State Machine
The orchestrator extension maintains workflow state:
- `IDLE` → `RESEARCHING` → `PLANNING` → `PENDING_APPROVAL` → `ORGANIZING` → `COMPLETE`
#### Hard User Approval Gates
- **PLAN.md Gate**: Workflow **stops** after PLAN.md generation. User must explicitly approve before ORGANIZER runs.
- **Ambiguity Gates**: Planner uses custom `ask_user` tool that blocks execution until clarification is received.
#### Pre-granted Permissions
- **gh-cli commands**: `gh issue create`, `gh issue list`, `gh api` execute without user confirmation
- **All other write operations**: Require explicit user approval or are blocked
---
### 3. Drift Prevention Mechanisms
#### Extension-Level Enforcement
- **Tool Filtering**: The extension intercepts all `bash` tool calls and blocks unapproved commands
- **Phase Context Injection**: Before each agent starts, the extension injects phase-specific context (e.g., "You are RESEARCHER - verify documentation")
- **State Validation**: Agents cannot proceed to next phase without state machine transition
#### Agent Behavior Constraints
- **RESEARCHER**: Source restrictions enforced via system prompt + tool filtering (blocks non-official doc URLs)
- **PLANNER**: Code-write prevention enforced by removing `write` and `edit` tools from available set
- **ORGANIZER**: Scope limitation enforced by bash command filtering (only gh-cli allowed)
---
### 4. Progressive Disclosure via Skills
Following Pi's architecture, capabilities are loaded on-demand:
#### gh-cli Skill (Custom)
- Encapsulates GitHub CLI operations
- Pre-granted execution for planning workflow commands
- Isolated from other bash operations

### Research Approach
The RESEARCHER agent attempts to locate official documentation using webfetch or known URLs. If official documentation cannot be found for a critical technology, the agent asks the user to provide the link rather than relying on web search.
---
### 5. Template-Driven Outputs
All agent outputs follow structured templates:
#### Pre-Plan Template
- Verified Technology Stack
- API Authentication Requirements (with official doc links)
- Potential Risks and Blockers
- Official Documentation Consulted (links)
#### Plan Template
- Project/Feature Overview
- Step-by-Step Implementation Guide
- API References (linking to pre-plan official docs)
- Anti-Patterns to Avoid
- Testing Strategy
- Rollback Procedures
#### Issue Templates
- Feature Issue Template
- Story Issue Template
- Task Issue Template
- All include acceptance criteria and traceability to plan sections
---
## System Architecture
┌─────────────────────────────────────────────────────────────────┐
│                        USER INTERFACE                            │
│                    (Pi Terminal / TUI)                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              PLANNING ORCHESTRATOR EXTENSION                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │   State      │  │   Custom     │  │   Event Handlers     │ │
│  │   Machine    │  │   Tools      │  │   (tool_call,        │ │
│  │              │  │   (plan,     │  │    before_agent_     │ │
│  │ IDLE →       │  │    approve_  │  │    start, etc)        │ │
│  │ RESEARCHING  │  │    plan,    │  │                      │ │
│  │ PLANNING →   │  │    ask_user) │  │ • Filter bash cmds   │ │
│  │ PENDING_     │  │              │  │ • Inject phase ctx   │ │
│  │ APPROVAL →   │  │              │  │ • Validate state      │ │
│  │ ORGANIZING → │  │              │  │ • Track completion   │ │
│  │ COMPLETE     │  │              │  │                      │ │
│  └──────────────┘  └──────────────┘  └──────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
        ┌──────────────────┐   ┌──────────────────┐
        │   SUBAGENT TOOL │   │   SKILL LOADER   │
        │   (built-in)     │   │   (gh-cli)       │
        │                  │   │                  │
        └────────┬─────────┘   └──────────────────┘
                 │
    ┌────────────┼────────────┐
    ▼            ▼            ▼
┌────────┐  ┌────────┐  ┌────────┐
│RESEARCH│  │PLANNER │  │ORGANIZE│
│   ER   │  │        │  │   R    │
│Agent   │  │ Agent  │  │ Agent  │
└────────┘  └────────┘  └────────┘
---
## File Organization
.pi/
├── AGENTS.md                    # Global workflow instructions (loaded at startup)
├── extensions/
│   └── planning-orchestrator.ts # Extension implementing state machine + gates
├── agents/                       # Agent definitions for subagent tool
│   ├── researcher.md            # Pre-plan research (official docs only)
│   ├── planner.md               # Plan generation (no code writing)
│   └── organizer.md             # GitHub issue creation (gh-cli only)
├── skills/
│   └── gh-cli/
│       └── SKILL.md              # Pre-approved GitHub CLI operations
├── prompts/
│   ├── pre-plan.md              # RESEARCHER output template
│   ├── plan.md                  # PLANNER output template
│   └── issue-templates/
│       ├── feature.md           # GitHub feature issue template
│       ├── story.md             # GitHub story issue template
│       └── task.md              # GitHub task issue template
└── settings.json                # Enable extension + configure agent scope
---
## Key Design Decisions
### 1. Extension-Based Enforcement Over Instructions
**Why**: OpenCode's approach relied on agents following instructions, which they could ignore. Pi's extension API allows **tool-level enforcement** that cannot be bypassed.
### 2. Pre-granted Permissions with Narrow Scope
**Why**: GitHub CLI operations are pre-approved only for specific commands (`gh issue create`, etc.), reducing friction while maintaining security. All other operations require confirmation.
### 3. Mandatory User Approval Gates
**Why**: Prevents the "drift" where agents auto-proceed. The PLAN.md gate ensures users review plans before issues are created.
### 4. Official Documentation Only
**Why**: Prevents incorrect assumptions from outdated blog posts. The RESEARCHER is explicitly instructed to reject non-official sources.
### 5. Planning-Only (No Code Generation)
**Why**: Keeps the system focused and prevents scope creep. Code generation is a separate concern that can use the generated PLAN.md.
---
## Usage Flow
1. **User**: `/plan "Add OAuth authentication with GitHub"`
2. **PLANNER** (primary): Receives request, invokes RESEARCHER via subagent
3. **RESEARCHER**: Searches official GitHub OAuth docs, outputs `pre-plan.md`
4. **PLANNER**: Generates `PLAN.md` with implementation steps
5. **System**: **HARD STOP** - Displays PLAN.md, prompts user for approval
6. **User**: Reviews PLAN.md, approves or requests changes
7. **ORGANIZER** (subagent): Creates GitHub issues from approved plan
8. **System**: Workflow complete - issues created, user can begin implementation
---
## Success Metrics
| Metric | Target | Enforcement Mechanism |
|--------|--------|----------------------|
| Code Generation | Zero instances | Remove `write`/`edit` tools from PLANNER |
| Unverified Sources | Zero instances | RESEARCHER prompt + URL filtering in extension |
| Skipped User Approvals | Zero instances | State machine + UI confirmation dialogs |
| Assumption-Based Plans | Zero instances | `ask_user` tool blocks on ambiguity |
| Pre-granted Command Scope | gh-cli only | Bash command regex filtering in extension |
---
## Future Extensions (Out of Scope)
- **Coder Agent**: Could read PLAN.md and implement (separate extension)
- **Spec Verifier**: Could verify implementation against PLAN.md (post-implementation)
- **Multi-Provider Support**: Could support GitLab, Azure DevOps, etc.
---
## Documentation
- [Pi Coding Agent](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent)
- [Pi Skills](https://github.com/badlogic/pi-skills)
- [Agent Skills Standard](https://agentskills.io/specification)
- [Pi Extension Examples](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent/examples/extensions)