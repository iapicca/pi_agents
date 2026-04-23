# Pi Architecture & Workflow Enforcement Analysis

## Date: 2026-04-23
## Purpose: Understand why current pi-agents orchestrators fail to enforce guardrails

---

## 1. How Pi Actually Works

Pi is a minimal terminal coding harness with exactly ONE primary agent per session.
Everything else is built via extensions.

### Core Architecture
- One LLM, one context window per interactive session
- Tools (read, write, edit, bash, etc.) are presented to the LLM in the system prompt
- Extensions can:
  - Register custom tools/commands
  - Intercept tool calls via events
  - Inject context via before_agent_start
  - Dynamically restrict available tools via pi.setActiveTools()
- Subagents are NOT native - they are implemented by spawning separate pi --mode json processes

### The Critical API: pi.setActiveTools()

From pi-mono docs/extensions.md:

pi.setActiveTools(["read", "bash"]); // Switch to read-only
pi.setActiveTools(["read", "bash", "edit", "write"]); // Restore full access

This actually removes tools from the LLM's system prompt. If write is not in the active
tools list, the LLM literally cannot see it as an available tool. This is the ONLY reliable
way to prevent the LLM from using a tool.

### Secondary Enforcement: pi.on("tool_call", ...)

This fires AFTER the LLM decides to call a tool but BEFORE execution. It can block with:

return { block: true, reason: "Blocked: write not allowed in planning phase" };

But this is a runtime gate, not a prevention mechanism. The LLM can still attempt to call
blocked tools. If you only use this without setActiveTools(), the LLM will keep trying
blocked tools, wasting tokens and confusing the workflow.

### Tertiary Enforcement: before_agent_start Context Injection

Inject persistent messages into the context window reminding the LLM of current phase constraints.

---

## 2. Why the Current Orchestrators Fail

### The Current Approach (FLAWED)

The existing planning-orchestrator.ts and coding-orchestrator.ts:

1. Register workflow tools (plan, approve_plan, code, submit_plan, etc.)
2. Track state machine in memory
3. Use pi.on("tool_call", ...) to block bash commands during planning
4. NEVER call pi.setActiveTools() to remove write/edit during planning phases
5. Rely on the LLM to voluntarily invoke subagent with the right agent
6. No before_agent_start injection to reinforce phase constraints

### What Happens in Practice

When user types /plan "Add OAuth":

1. Extension's plan tool runs -> state becomes RESEARCHING
2. Tool result tells LLM: "Phase 1: RESEARCHER - invoking subagent..."
3. LLM still sees write, edit in its available tools
4. LLM may:
   a) Correctly call subagent with agent: "researcher" (ideal case)
   b) Decide to just write .tmp/pre-plan.md directly with write tool (THE BUG)
   c) Write code directly instead of planning

The planner writing code happens because:
- The LLM has write and edit tools available
- The system prompt does not mechanically enforce phase restrictions
- There is no setActiveTools() narrowing
- AGENTS.md instructions are just context - they don't enforce anything

---

## 3. How Pi's Official Plan-Mode Extension Solves This

The pi-mono examples/extensions/plan-mode/ is the canonical reference for read-only phases.

### Key Implementation:

const PLAN_MODE_TOOLS = ["read", "bash", "grep", "find", "ls", "questionnaire"];
const NORMAL_MODE_TOOLS = ["read", "bash", "edit", "write"];

function togglePlanMode(ctx: ExtensionContext): void {
  planModeEnabled = !planModeEnabled;
  if (planModeEnabled) {
    pi.setActiveTools(PLAN_MODE_TOOLS); // <-- MECHANICAL ENFORCEMENT
  } else {
    pi.setActiveTools(NORMAL_MODE_TOOLS);
  }
}

// Also block bash in plan mode
pi.on("tool_call", async (event) => {
  if (!planModeEnabled || event.toolName !== "bash") return;
  const command = event.input.command as string;
  if (!isSafeCommand(command)) {
    return { block: true, reason: "Plan mode: command blocked" };
  }
});

// Also inject context reminding the LLM
pi.on("before_agent_start", async () => {
  if (planModeEnabled) {
    return {
      message: {
        customType: "plan-mode-context",
        content: "[PLAN MODE ACTIVE] You CANNOT use: edit, write...",
        display: false,
      }
    };
  }
});

### The Pattern: Three Layers of Enforcement

1. setActiveTools() - Mechanical: remove forbidden tools from LLM's view
2. tool_call blocking - Runtime: catch any attempts that slip through
3. before_agent_start injection - Psychological: remind LLM of constraints

---

## 4. How Pi's Official Subagent Extension Works

The pi-mono examples/extensions/subagent/ spawns separate pi processes:

const args: string[] = ["--mode", "json", "-p", "--no-session"];
if (agent.model) args.push("--model", agent.model);
if (agent.tools && agent.tools.length > 0) args.push("--tools", agent.tools.join(","));
if (agent.systemPrompt.trim()) {
  args.push("--append-system-prompt", tmpPromptPath);
}
args.push(`Task: ${task}`);

spawn("pi", args, { cwd, stdio: ["ignore", "pipe", "pipe"] });

Each subagent is a separate pi process with:
- Its own isolated context window
- Its own tool set (via --tools flag)
- Its own system prompt (via --append-system-prompt)

---

## 5. Specific Problems in Current Extensions

### planning-orchestrator.ts

1. No setActiveTools() calls anywhere - the LLM always sees all tools
2. State machine does not actually control tool availability - it is purely informational
3. complete_research, submit_plan, etc. are tools the LLM calls - but the LLM might never call them
4. before_agent_start only injects phase prompts, never restricts tools
5. The tool_call bash filtering is incomplete - it blocks some bash but not write/edit

### coding-orchestrator.ts

1. Same issues as planning orchestrator
2. Branch creation logic is in the extension but not enforced
3. No tool restrictions during planning phases - implementation planner can write code

---

## 6. Recommended Architecture Changes

### Option A: Fix Existing Orchestrators (Minimal)

Add pi.setActiveTools() calls at every state transition:

function enterPhase(phase: WorkflowState, ctx: ExtensionContext) {
  workflow.state = phase;
  workflow.currentPhase = phase;
  
  switch (phase) {
    case "RESEARCHING":
    case "PLANNING":
      pi.setActiveTools(["read", "grep", "find", "ls", "bash", "subagent", "ask_user"]);
      break;
    case "ORGANIZING":
      pi.setActiveTools(["read", "bash", "gh_issue_create", "gh_issue_list", "gh_issue_view", "gh_repo_view", "gh_api"]);
      break;
    case "PENDING_APPROVAL":
    case "COMPLETE":
    case "IDLE":
      pi.setActiveTools(FULL_TOOLS);
      break;
  }
  
  updateStatus(ctx);
  persistState();
}

Also add write/edit blocking in tool_call handler:

pi.on("tool_call", async (event) => {
  if (workflow.state === "RESEARCHING" || workflow.state === "PLANNING") {
    if (event.toolName === "write" || event.toolName === "edit") {
      return { block: true, reason: "Write/edit forbidden in this phase" };
    }
  }
});

### Option B: Rewrite as Proper State Machine (Better)

1. Make /plan and /code commands, not tools
2. User explicitly types /plan "..." -> enters RESEARCHING phase with restricted tools
3. RESEARCHER subagent is spawned automatically by the extension
4. When subagent completes, extension auto-transitions to PLANNING and spawns PLANNER
5. PLANNER output is captured, then state becomes PENDING_APPROVAL
6. User types /approve_plan -> enters ORGANIZING, spawns ORGANIZER

This removes LLM agency from workflow transitions entirely. The extension drives the workflow.

### Option C: Hybrid Approach (Best)

Keep the current command-driven workflow but:
1. Add setActiveTools() restrictions per phase
2. Add write/edit blocking in tool_call
3. Strengthen before_agent_start context injection
4. Provide a custom write_plan tool that only allows writing to .tmp/ during planning
5. Auto-spawn subagents from within the extension when phases change

---

## 7. Key Pi Documentation References

- Extension API: https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/extensions.md
- Plan Mode Example: https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent/examples/extensions/plan-mode/
- Subagent Example: https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent/examples/extensions/subagent/
- Permission Gate Example: https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/examples/extensions/permission-gate.ts
- Protected Paths Example: https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/examples/extensions/protected-paths.ts

---

## 8. Summary

THE ROOT CAUSE: Your orchestrators track workflow state but never mechanically restrict
the LLM's tools. They rely on the LLM reading AGENTS.md and voluntarily complying.
LLMs don't reliably comply with "please don't use write" when write is still in their tool list.

THE FIX: Use pi.setActiveTools() at every state transition to remove forbidden tools from
the LLM's context. Complement with pi.on("tool_call", ...) blocking for defense in depth,
and before_agent_start injection for clarity.

THE DEEPER FIX: Make workflow transitions driven by user commands + extension logic rather
than LLM tool calls. The extension should spawn subagents directly, not wait for the LLM
to decide to call subagent.
