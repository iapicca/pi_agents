/**
 * Planning Orchestrator Extension — Strategy C (Hybrid Enforcement)
 *
 * Enforces a strict three-agent planning workflow:
 * IDLE → RESEARCHING → PLANNING → PENDING_APPROVAL → ORGANIZING → COMPLETE
 *
 * Key changes from previous version:
 * - Command-driven entry points (/plan, /approve-plan)
 * - Extension auto-spawns RESEARCHER and ORGANIZER subagents
 * - pi.setActiveTools() mechanically restricts tools per phase
 * - Path-based blocking: write/edit outside .tmp/ is forbidden during planning
 * - Only PLANNER (main session) interacts with the user
 */

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSubagent } from "./workflow-helpers.js";

type WorkflowState =
  | "IDLE"
  | "RESEARCHING"
  | "PLANNING"
  | "PENDING_APPROVAL"
  | "ORGANIZING"
  | "COMPLETE";

interface WorkflowData {
  state: WorkflowState;
  userRequest: string;
  prePlanContent?: string;
  planContent?: string;
  planApproved: boolean;
  currentPhase: string;
  startTime: number;
  feedback?: string;
}

// ── Tool sets for setActiveTools() ───────────────────────────────────────────

const READONLY_TOOLS = ["read", "grep", "find", "ls", "bash", "webfetch"];

const PLANNING_TOOLS = [
  "read", "grep", "find", "ls", "bash", "write", "edit",
  "ask_user", "subagent", "submit_plan", "webfetch",
];

const ORGANIZING_TOOLS = [
  "read", "bash",
  "gh_issue_create", "gh_issue_list", "gh_issue_view",
  "gh_repo_view", "gh_api", "gh_remote_url",
];

const FULL_TOOLS = [
  "read", "grep", "find", "ls", "bash", "subagent", "write", "edit",
  "gh_issue_create", "gh_issue_list", "gh_issue_view",
  "gh_pr_create", "gh_pr_merge", "gh_pr_view",
  "gh_repo_view", "gh_api", "gh_remote_url",
  "ask_user", "submit_plan", "complete_coding", "webfetch",
];

// ── Pre-granted bash commands (no confirmation) ──────────────────────────────
// NOTE: No raw `gh` CLI commands here. Agents MUST use gh-extension tools.

const PRE_GRANTED_COMMANDS = [
  /^mkdir -p \.tmp/,
  /^touch \.tmp\//,
  /^cat \.tmp\//,
  /^ls \.tmp\//,
  /^rm \.tmp\//,
];

// Blocked commands (always blocked)
const BLOCKED_COMMANDS = [
  /^rm -rf\b/,
  /^sudo\b/,
  /^chmod\b.*777/,
  /^chown\b/,
  /^(npm|yarn|pnpm) install\b/,
  /^pip install\b/,
  /^cargo install\b/,
  /^go get\b/,
];

function isPreGrantedCommand(command: string): boolean {
  return PRE_GRANTED_COMMANDS.some((pattern) => pattern.test(command));
}

function isBlockedCommand(command: string): boolean {
  return BLOCKED_COMMANDS.some((pattern) => pattern.test(command));
}

function getStateDisplay(state: WorkflowState): string {
  const displays: Record<WorkflowState, string> = {
    IDLE: "⏸ Idle - Ready to plan",
    RESEARCHING: "🔍 Researching - Verifying documentation",
    PLANNING: "📝 Planning - Generating implementation plan",
    PENDING_APPROVAL: "⏳ Pending - Awaiting user approval",
    ORGANIZING: "📋 Organizing - Creating GitHub issues",
    COMPLETE: "✅ Complete - Issues created",
  };
  return displays[state];
}

function loadPrompt(phase: string): string {
  const path = join(".pi/prompts/extensions/planning-orchestrator", `${phase}.md`);
  try {
    return readFileSync(path, "utf-8");
  } catch {
    return `[PLANNING WORKFLOW: ${phase.toUpperCase().replace(/-/g, " ")} PHASE]\n\n⚠️ Prompt file not found: ${path}`;
  }
}

// ── Main extension ───────────────────────────────────────────────────────────

export default function planningOrchestrator(pi: ExtensionAPI): void {
  let workflow: WorkflowData = {
    state: "IDLE",
    userRequest: "",
    planApproved: false,
    currentPhase: "IDLE",
    startTime: Date.now(),
  };

  pi.registerFlag("plan", {
    description: "Start in planning workflow mode",
    type: "boolean",
    default: false,
  });

  function updateStatus(ctx: ExtensionContext): void {
    ctx.ui.setStatus("planning-workflow", ctx.ui.theme.fg("accent", getStateDisplay(workflow.state)));
  }

  function persistState(): void {
    pi.appendEntry("planning-workflow", {
      state: workflow.state,
      userRequest: workflow.userRequest,
      planApproved: workflow.planApproved,
      currentPhase: workflow.currentPhase,
      feedback: workflow.feedback,
    });
  }

  // Auto-advance through states that are fully extension-driven.
  // Returns when reaching a state that requires main-session participation.
  async function advanceWorkflow(ctx: ExtensionContext): Promise<void> {
    while (true) {
      switch (workflow.state) {
        case "RESEARCHING": {
          pi.setActiveTools(READONLY_TOOLS);
          updateStatus(ctx);
          ctx.ui.notify("🔍 Spawning RESEARCHER subagent...", "info");

          const result = await spawnSubagent(
            ctx.cwd,
            "researcher",
            `Research and verify official documentation for: "${workflow.userRequest}". ` +
            `Create .tmp/pre-plan.md with verified tech stack, API auth requirements, and risks. ` +
            `If official docs cannot be found, note it clearly in the file for the PLANNER to resolve.`
          );

          if (result.isError) {
            workflow.state = "IDLE";
            pi.setActiveTools(FULL_TOOLS);
            updateStatus(ctx);
            persistState();
            ctx.ui.notify("❌ Research failed: " + result.content?.[0]?.text, "error");
            return;
          }

          workflow.state = "PLANNING";
          workflow.currentPhase = "PLANNING";
          persistState();
          continue;
        }

        case "PLANNING": {
          pi.setActiveTools(PLANNING_TOOLS);
          updateStatus(ctx);
          ctx.ui.notify(
            "📝 PLANNING phase: Read .tmp/pre-plan.md, ask clarifying questions if needed, write .tmp/PLAN.md, then call submit_plan.",
            "info"
          );
          return; // main session takes over
        }

        case "ORGANIZING": {
          pi.setActiveTools(ORGANIZING_TOOLS);
          updateStatus(ctx);
          ctx.ui.notify("📋 Spawning ORGANIZER subagent...", "info");

          const result = await spawnSubagent(
            ctx.cwd,
            "organizer",
            `Create GitHub issues from the approved plan in .tmp/PLAN.md. ` +
            `Use semantic versioning in titles (e.g., [1] Feat, [1.1] Story, [1.1.1] Task).`
          );

          if (result.isError) {
            workflow.state = "IDLE";
            pi.setActiveTools(FULL_TOOLS);
            updateStatus(ctx);
            persistState();
            ctx.ui.notify("❌ Organizer failed: " + result.content?.[0]?.text, "error");
            return;
          }

          workflow.state = "COMPLETE";
          workflow.currentPhase = "COMPLETE";
          persistState();
          continue;
        }

        case "COMPLETE": {
          pi.setActiveTools(FULL_TOOLS);
          const duration = Math.round((Date.now() - workflow.startTime) / 1000);
          updateStatus(ctx);
          ctx.ui.notify(`✅ Planning complete! Duration: ${duration}s`, "info");
          return;
        }

        case "IDLE":
        case "PENDING_APPROVAL":
          return;
      }
    }
  }

  // ============ COMMANDS ============

  pi.registerCommand("plan", {
    description: "Start the planning workflow for a feature or task",
    handler: async (args, ctx) => {
      const request = args.trim();
      if (!request) {
        ctx.ui.notify('Usage: /plan "<feature description>"', "error");
        return;
      }

      if (workflow.state !== "IDLE" && workflow.state !== "COMPLETE") {
        ctx.ui.notify(
          `❌ Workflow already in progress (state: ${workflow.state}). Use /reset-plan to start fresh.`,
          "error"
        );
        return;
      }

      workflow = {
        state: "RESEARCHING",
        userRequest: request,
        planApproved: false,
        currentPhase: "RESEARCHING",
        startTime: Date.now(),
        feedback: undefined,
      };

      updateStatus(ctx);
      persistState();
      await advanceWorkflow(ctx);
    },
  });

  pi.registerCommand("approve-plan", {
    description: "Approve the plan (no args) or request changes (provide feedback)",
    handler: async (args, ctx) => {
      if (workflow.state !== "PENDING_APPROVAL") {
        ctx.ui.notify(
          `❌ Cannot approve: Workflow is in ${workflow.state} state. Must be in PENDING_APPROVAL.`,
          "error"
        );
        return;
      }

      const feedback = args.trim();

      if (feedback) {
        // Rejection with feedback — return to PLANNING
        workflow.state = "PLANNING";
        workflow.currentPhase = "PLANNING";
        workflow.feedback = feedback;
        pi.setActiveTools(PLANNING_TOOLS);
        updateStatus(ctx);
        persistState();
        ctx.ui.notify("🔄 Plan rejected. Feedback provided. Please revise the plan.", "info");
      } else {
        // Approval — proceed to ORGANIZING
        workflow.state = "ORGANIZING";
        workflow.planApproved = true;
        workflow.currentPhase = "ORGANIZING";
        workflow.feedback = undefined;
        updateStatus(ctx);
        persistState();
        await advanceWorkflow(ctx);
      }
    },
  });

  pi.registerCommand("reset-plan", {
    description: "Reset the planning workflow to IDLE state",
    handler: async (_args, ctx) => {
      workflow = {
        state: "IDLE",
        userRequest: "",
        planApproved: false,
        currentPhase: "IDLE",
        startTime: Date.now(),
        feedback: undefined,
      };
      pi.setActiveTools(FULL_TOOLS);
      updateStatus(ctx);
      persistState();
      ctx.ui.notify("Planning workflow reset to IDLE state", "info");
    },
  });

  pi.registerCommand("plan-status", {
    description: "Show current planning workflow status",
    handler: async (_args, ctx) => {
      const status = `
📊 Planning Workflow Status
${"─".repeat(40)}
State: ${workflow.state}
Phase: ${workflow.currentPhase}
Request: ${workflow.userRequest || "(none)"}
Plan Approved: ${workflow.planApproved ? "✅" : "⏳"}
Feedback: ${workflow.feedback || "(none)"}
      `.trim();
      ctx.ui.notify(status, "info");
    },
  });

  // ============ TOOLS (main-session only) ============

  // Tool: submit_plan — called by PLANNER to signal completion
  pi.registerTool({
    name: "submit_plan",
    label: "Submit Plan",
    description: "Called by PLANNER to submit the completed PLAN.md for user approval.",
    parameters: Type.Object({
      planPath: Type.String({ description: "Path to the generated PLAN.md file", default: ".tmp/PLAN.md" }),
    }),

    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (workflow.state !== "PLANNING") {
        return {
          content: [{ type: "text", text: `❌ Cannot submit plan: Workflow is in ${workflow.state} state.` }],
          isError: true,
        };
      }

      try {
        if (existsSync(params.planPath)) {
          workflow.planContent = readFileSync(params.planPath, "utf-8");
        }
      } catch {
        // Ignore read errors
      }

      workflow.state = "PENDING_APPROVAL";
      workflow.currentPhase = "PENDING_APPROVAL";
      pi.setActiveTools(["read", "bash"]);
      updateStatus(ctx);
      persistState();

      const planPreview = workflow.planContent
        ? workflow.planContent.substring(0, 500) + (workflow.planContent.length > 500 ? "\n..." : "")
        : "(Plan content not available)";

      return {
        content: [{
          type: "text",
          text:
            `🎯 PLAN.md Generated!\n\n` +
            `📄 Location: ${params.planPath}\n\n` +
            `📝 Preview:\n${"─".repeat(60)}\n${planPreview}\n${"─".repeat(60)}\n\n` +
            `⏳ **HARD STOP: USER APPROVAL REQUIRED**\n\n` +
            `To proceed:\n` +
            `1. Review the PLAN.md file\n` +
            `2. Use "/approve-plan" to approve\n` +
            `3. Or use "/approve-plan <feedback>" to request changes\n\n` +
            `⚠️ The ORGANIZER will NOT run until you explicitly approve the plan.`,
        }],
      };
    },
  });

  // Tool: ask_user — called by PLANNER for clarifications
  pi.registerTool({
    name: "ask_user",
    label: "Ask User",
    description: "Ask the user for clarification on ambiguous requirements. Blocks until user responds.",
    parameters: Type.Object({
      question: Type.String({ description: "The specific question about ambiguous requirements" }),
      context: Type.Optional(Type.String({ description: "Additional context to help user understand" })),
    }),

    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (!ctx.hasUI) {
        return {
          content: [{ type: "text", text: `❌ Cannot ask user: No UI available in non-interactive mode.` }],
          isError: true,
        };
      }

      const fullQuestion = params.context
        ? `❓ Clarification needed:\n\n${params.question}\n\nContext: ${params.context}`
        : `❓ Clarification needed:\n\n${params.question}`;

      const response = await ctx.ui.editor("Clarification Required", fullQuestion);

      if (!response || !response.trim()) {
        return {
          content: [{ type: "text", text: `⏸️ No response provided. Please answer the question to proceed with planning.` }],
        };
      }

      return {
        content: [{ type: "text", text: `✅ User clarification received:\n${response}` }],
      };
    },
  });

  // ============ EVENT HANDLERS ============

  // Enhanced tool_call blocking with path-based restrictions
  pi.on("tool_call", async (event) => {
    // Block write/edit outside .tmp/ during PLANNING
    if (workflow.state === "PLANNING") {
      if (event.toolName === "write" || event.toolName === "edit") {
        const filePath = (event.input.file_path || event.input.path || "") as string;
        if (!filePath.startsWith(".tmp/")) {
          return {
            block: true,
            reason:
              `🚫 Write/edit blocked in PLANNING phase for path: "${filePath}"\n\n` +
              `Only .tmp/ directory is writable during planning. Use .tmp/PLAN.md for the plan.`,
          };
        }
      }
    }

    // Block write/edit entirely during RESEARCHING and ORGANIZING
    if (workflow.state === "RESEARCHING" || workflow.state === "ORGANIZING") {
      if (event.toolName === "write" || event.toolName === "edit") {
        return {
          block: true,
          reason:
            `🚫 Write/edit is forbidden during ${workflow.state} phase.\n\n` +
            `Subagents handle all file writes in this phase.`,
        };
      }
    }

    // Block subagent during ORGANIZING (extension manages it)
    if (workflow.state === "ORGANIZING" && event.toolName === "subagent") {
      return {
        block: true,
        reason:
          `🚫 Subagent invocation blocked during ORGANIZING phase.\n\n` +
          `The extension manages subagents automatically.`,
      };
    }

    if (event.toolName !== "bash") return undefined;

    const command = event.input.command as string;

    // Always block dangerous commands
    if (isBlockedCommand(command)) {
      return {
        block: true,
        reason: `🚫 Command blocked by planning workflow: "${command}"`,
      };
    }

    // Check pre-granted permissions
    if (isPreGrantedCommand(command)) {
      return undefined;
    }

    // During RESEARCHING and PLANNING, restrict bash to read-only
    if (workflow.state === "RESEARCHING" || workflow.state === "PLANNING") {
      const readOnlyPatterns = [
        /^(cat|head|tail|less|more)\b/,
        /^(grep|find|ls|pwd|tree)\b/,
        /^git\s+(status|log|diff|branch|remote)\b/,
        /^(npm|yarn|pnpm)\s+list\b/,
        /^mkdir -p \.tmp/,
        /^touch \.tmp\//,
        /^cat \.tmp\//,
        /^ls \.tmp\//,
      ];

      const isReadOnly = readOnlyPatterns.some((p) => p.test(command));

      if (!isReadOnly) {
        return {
          block: true,
          reason:
            `⏸️ Command blocked in ${workflow.state} phase: "${command}"\n\n` +
            `During ${workflow.state.toLowerCase()}, only read-only and pre-granted commands are allowed.\n\n` +
            `Use "/reset-plan" to exit planning mode if needed.`,
        };
      }
    }

    return undefined;
  });

  // Inject phase-specific context before agent starts
  pi.on("before_agent_start", async () => {
    if (workflow.state === "PLANNING") {
      let content = loadPrompt("planner-phase");
      if (workflow.feedback) {
        content +=
          `\n\n📣 USER FEEDBACK ON PREVIOUS PLAN:\n` +
          `${workflow.feedback}\n\n` +
          `Please revise the plan incorporating this feedback.`;
        workflow.feedback = undefined;
        persistState();
      }
      return {
        message: {
          customType: "planning-context",
          content,
          display: false,
        },
      };
    }

    if (workflow.state === "RESEARCHING") {
      return {
        message: {
          customType: "planning-context",
          content:
            `[PLANNING WORKFLOW: RESEARCHING PHASE]\n\n` +
            `The RESEARCHER subagent is currently running. ` +
            `Your tools are restricted to read-only during this phase.`,
          display: false,
        },
      };
    }

    if (workflow.state === "ORGANIZING") {
      return {
        message: {
          customType: "planning-context",
          content:
            `[PLANNING WORKFLOW: ORGANIZING PHASE]\n\n` +
            `The ORGANIZER subagent is currently creating GitHub issues. ` +
            `Your tools are restricted during this phase.`,
          display: false,
        },
      };
    }

    if (workflow.state === "PENDING_APPROVAL") {
      return {
        message: {
          customType: "planning-context",
          content:
            `[PLANNING WORKFLOW: PENDING APPROVAL]\n\n` +
            `⏳ HARD STOP: The PLAN.md is ready for your review.\n\n` +
            `Please review .tmp/PLAN.md, then:\n` +
            `• Approve: /approve-plan\n` +
            `• Request changes: /approve-plan <your feedback>\n\n` +
            `Your tools are restricted until you approve or reset.`,
          display: false,
        },
      };
    }

    return undefined;
  });

  // Handle workflow state on session start/resume
  pi.on("session_start", async (_event, ctx) => {
    if (pi.getFlag("plan") === true) {
      ctx.ui.notify('Planning workflow mode active. Use /plan "<request>" to start.', "info");
    }

    // Restore state from session entries
    const entries = ctx.sessionManager.getEntries();
    const workflowEntry = entries
      .filter((e: { type: string; customType?: string }) => e.type === "custom" && e.customType === "planning-workflow")
      .pop() as { data?: WorkflowData } | undefined;

    if (workflowEntry?.data) {
      workflow = {
        ...workflow,
        state: workflowEntry.data.state ?? workflow.state,
        userRequest: workflowEntry.data.userRequest ?? workflow.userRequest,
        planApproved: workflowEntry.data.planApproved ?? workflow.planApproved,
        currentPhase: workflowEntry.data.currentPhase ?? workflow.currentPhase,
        feedback: workflowEntry.data.feedback ?? workflow.feedback,
      };
    }

    // Restore appropriate tool set based on current state
    switch (workflow.state) {
      case "RESEARCHING":
        pi.setActiveTools(READONLY_TOOLS);
        break;
      case "PLANNING":
        pi.setActiveTools(PLANNING_TOOLS);
        break;
      case "PENDING_APPROVAL":
        pi.setActiveTools(["read", "bash"]);
        break;
      case "ORGANIZING":
        pi.setActiveTools(ORGANIZING_TOOLS);
        break;
      case "COMPLETE":
      case "IDLE":
        pi.setActiveTools(FULL_TOOLS);
        break;
    }

    updateStatus(ctx);
  });

  pi.on("extension_load", async (_event, ctx) => {
    updateStatus(ctx);
  });
}
