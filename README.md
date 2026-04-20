# Pi Planning Workflow System

A **strict, drift-resistant, planning-only workflow system** for [Pi](https://pi.dev) that enforces a three-agent methodology: **RESEARCHER → PLANNER → ORGANIZER**.

> ⚠️ **This system does NOT generate code** - it creates detailed implementation plans and GitHub issues only.

## 🎯 What This Solves

If you've experienced agents that:
- Skip steps in the workflow
- Make incorrect assumptions instead of asking
- Trust blog posts over official documentation
- Auto-proceed without your approval
- Drift from intended behavior over time

**This system prevents all of that** through Pi's extension API, which enforces workflow at the **tool level** (not just instructions that can be ignored).

## 🏗️ Architecture

```
User Request → RESEARCHER (subagent) → PLANNER (primary) → [HARD STOP] → User Approval → ORGANIZER (subagent)
```

### Three-Agent Workflow

| Agent | Purpose | Mode | Key Constraint |
|-------|---------|------|----------------|
| **RESEARCHER** | Verify official documentation | Subagent | Uses ONLY official sources (rejects Medium/StackOverflow) |
| **PLANNER** | Generate implementation plan | Primary | NEVER writes code; MUST ask on ambiguity |
| **ORGANIZER** | Create GitHub issues | Subagent | Only runs after explicit user approval |

### Workflow Enforcement

- **State Machine**: Tracks phases (IDLE → RESEARCHING → PLANNING → PENDING_APPROVAL → ORGANIZING → COMPLETE)
- **User Approval Gates**: Hard stops requiring your explicit approval
- **Pre-granted Permissions**: gh-cli commands execute without prompts; all other writes require confirmation
- **Tool Filtering**: Extension blocks unauthorized operations at the tool level

## 📦 Installation

### Prerequisites

1. **Install Pi Coding Agent**
   ```bash
   npm install -g @mariozechner/pi-coding-agent
   ```

2. **Install GitHub CLI**
   ```bash
   # macOS
   brew install gh

   # Ubuntu/Debian
   sudo apt install gh

   # Or download from https://github.com/cli/cli/releases
   ```

3. **Authenticate with GitHub**
   ```bash
   gh auth login
   ```

### Setup

1. **Clone this repository**
   ```bash
   git clone https://github.com/iapicca/pi_agents.git
   cd pi_agents
   ```

2. **Install the brave-search skill** (for official documentation research)
   ```bash
   # Clone to user-level skills
   git clone https://github.com/badlogic/pi-skills ~/.pi/agent/skills/pi-skills

   # Or clone to project-level skills
   git clone https://github.com/badlogic/pi-skills .pi/skills/pi-skills
   ```

3. **Configure brave-search** (optional, for web research)
   ```bash
   # Sign up for Brave Search API (free tier available)
   # https://api-dashboard.search.brave.com/register

   # Add API key to your shell profile
   export BRAVE_API_KEY="your-api-key-here"

   # Install dependencies
   cd ~/.pi/agent/skills/pi-skills/brave-search && npm install
   ```

## 🚀 Usage

### Starting a Planning Session

In your project directory (with the `.pi/` folder), start Pi:

```bash
pi
```

Then initiate the planning workflow:

```
/plan "Add OAuth authentication with GitHub"
```

### Workflow Steps

#### Step 1: Research Phase (RESEARCHER)
The RESEARCHER agent automatically:
- Finds official documentation for all technologies
- Rejects Medium, StackOverflow, and blog posts
- Verifies API authentication requirements
- Creates `.tmp/pre-plan.md` with verified information

**You'll see:**
```
🔍 Phase 1: RESEARCHER - Verifying official documentation...
Invoking RESEARCHER subagent to gather official documentation...
```

#### Step 2: Planning Phase (PLANNER)
The PLANNER agent:
- Reads the pre-plan
- Asks YOU for clarification if anything is ambiguous
- Generates `.tmp/PLAN.md` with:
  - Step-by-step implementation guide
  - API references with official doc links
  - Anti-patterns to avoid
  - Testing strategy
  - Rollback plan

**⚠️ IMPORTANT**: If the PLANNER detects ambiguity, it will ask you questions using the `ask_user` tool.

**You'll see:**
```
📝 Phase 2: PLANNER - Generating implementation plan...
```

#### Step 3: User Approval (HARD STOP)
**THIS IS THE CRITICAL GATE**

The system stops and displays:
```
🎯 PLAN.md Generated!

⏳ HARD STOP: USER APPROVAL REQUIRED

To proceed:
1. Review the PLAN.md file
2. Use "/approve_plan approved=true" to approve
3. Or use "/approve_plan approved=false feedback='...'" to request changes
```

**Your options:**

✅ **Approve the plan:**
```
/approve_plan approved=true
```

❌ **Request changes:**
```
/approve_plan approved=false feedback="Add more detail about error handling and include Redis caching"
```

The PLANNER will regenerate the plan incorporating your feedback.

#### Step 4: Organization Phase (ORGANIZER)
Only after your approval, the ORGANIZER:
- Reads the approved PLAN.md
- Creates hierarchical GitHub issues:
  - Features (parent)
  - Stories (children of features)
  - Tasks (children of stories)
- Uses pre-granted gh-cli permissions (no prompts)

**You'll see:**
```
✅ Plan approved! Proceeding to ORGANIZER phase...
📋 Creating GitHub issues from the approved plan.
```

#### Step 5: Complete
```
🎉 Planning Workflow Complete!

✅ Issues Created: 5
📊 Features: 1, Stories: 2, Tasks: 2
```

### Workflow Commands

| Command | Purpose |
|---------|---------|
| `/plan "request"` | Start a new planning workflow |
| `/approve_plan approved=true` | Approve the generated PLAN.md |
| `/approve_plan approved=false feedback="..."` | Request plan changes |
| `/plan-status` | Check current workflow status |
| `/reset-plan` | Emergency reset to IDLE state |

## 📁 File Structure

```
.pi/
├── extensions/
│   └── planning-orchestrator.ts    # Workflow enforcement + state machine
├── agents/
│   ├── researcher.md               # Official docs verification agent
│   ├── planner.md                  # Plan generation agent (primary)
│   └── organizer.md                # GitHub issue creation agent
├── skills/
│   └── gh-cli/
│       └── SKILL.md                 # Pre-approved gh-cli operations
├── prompts/
│   ├── pre-plan.md                  # Pre-plan template
│   ├── plan.md                      # Plan template
│   └── issue-templates/
│       ├── feature.md               # Feature issue template
│       ├── story.md                 # Story issue template
│       └── task.md                  # Task issue template
└── settings.json                    # Extension + agent configuration
```

### Generated Files

During workflow execution, these files are created in `.tmp/`:

| File | Created By | Purpose |
|------|------------|---------|
| `.tmp/pre-plan.md` | RESEARCHER | Verified tech stack, API docs, risks |
| `.tmp/PLAN.md` | PLANNER | Complete implementation plan |

## 🔒 Security & Permissions

### Pre-Granted Commands (No Confirmation)

These commands execute without user prompts:
- `gh issue create`
- `gh issue list`
- `gh issue view`
- `gh api`
- `gh repo view`
- `git remote get-url origin`
- `mkdir -p .tmp/`
- `touch .tmp/*`
- `cat .tmp/*`

### Blocked Commands (Always Blocked)

These commands are blocked during planning:
- `rm -rf` (destructive deletion)
- `sudo` (privileged operations)
- `chmod 777` (insecure permissions)
- `npm install`, `pip install`, etc. (dependency installation)

### Other Commands

All other bash commands require explicit user confirmation during the RESEARCHING and PLANNING phases.

## 🛠️ Customization

### Modifying Templates

Edit templates in `.pi/prompts/` to customize output format:

- **pre-plan.md**: RESEARCHER output structure
- **plan.md**: PLANNER output structure
- **issue-templates/**: GitHub issue formats

### Adjusting Agents

Edit agent definitions in `.pi/agents/`:

- **researcher.md**: Change research focus or sources
- **planner.md**: Modify planning constraints or output format
- **organizer.md**: Adjust issue creation workflow

### Changing Models

Modify the `model` field in agent frontmatter:

```yaml
---
name: planner
description: ...
model: claude-opus-4-5  # Change this
---
```

Available models depend on your Pi configuration. See [Pi Models](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent/docs/models.md).

## 🧪 Testing the Workflow

### Test 1: Ambiguity Detection

```
/plan "Make the app better"
```

**Expected:** PLANNER should ask clarifying questions via `ask_user` tool.

### Test 2: User Approval Gate

After PLAN.md is generated:

```
/approve_plan approved=false feedback="Add section about testing"
```

**Expected:** Returns to PLANNING phase, regenerates plan with testing section.

### Test 3: Pre-granted Permissions

During ORGANIZING phase:

**Expected:** `gh issue create` executes without confirmation prompt.

### Test 4: Tool Filtering

During RESEARCHING phase, try:

```
!rm -rf node_modules
```

**Expected:** Blocked with message: "Command blocked by planning workflow"

## ❌ What This System Does NOT Do

- ❌ Generate implementation code
- ❌ Create pull requests
- ❌ Automatically commit changes
- ❌ Install dependencies
- ❌ Modify files outside `.tmp/`
- ❌ Run in unsupervised mode

This is **planning-only** by design. Code generation is a separate concern.

## 📚 Documentation

### Pi Resources

- [Pi Coding Agent](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent)
- [Extension Development](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent/docs/extensions.md)
- [Skills Specification](https://agentskills.io/specification)
- [Pi Skills Repository](https://github.com/badlogic/pi-skills)

### Related Files

- [PLAN.md](./PLAN.md) - Implementation plan for this system
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Detailed architecture documentation
- [AGENTS.md](./AGENTS.md) - Global workflow instructions

## 🤝 Contributing

### Reporting Issues

If you encounter:
- Agents bypassing workflow phases
- Pre-granted commands prompting for confirmation
- User approval gates being skipped
- Incorrect assumptions instead of clarifying questions

Please open an issue with:
1. The command you used
2. What you expected to happen
3. What actually happened
4. Relevant output/logs

### Extending the System

#### Adding New Agents

1. Create `.pi/agents/your-agent.md`
2. Define frontmatter with `name`, `description`, `tools`
3. Write system prompt
4. Add agent invocation in orchestrator

#### Adding New Skills

1. Create `.pi/skills/skill-name/SKILL.md`
2. Define frontmatter per [Agent Skills spec](https://agentskills.io/specification)
3. Add skill to `.pi/settings.json`

## 📄 License

MIT License - see [LICENSE](./LICENSE) file

## 🙏 Acknowledgments

- [Pi Coding Agent](https://github.com/badlogic/pi-mono) by Mario Zechner
- [Pi Skills](https://github.com/badlogic/pi-skills) community
- [Agent Skills Standard](https://agentskills.io) specification

---

**Built for developers who want planning rigor without agent drift.**
