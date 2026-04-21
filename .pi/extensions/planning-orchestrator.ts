/**
 * Planning Orchestrator Extension
 *
 * Enforces a strict three-agent planning workflow:
 * IDLE → RESEARCHING → PLANNING → PENDING_APPROVAL → ORGANIZING → COMPLETE
 *
 * Features:
 * - State machine tracking workflow phases
 * - Hard user approval gates between phases
 * - Pre-granted permissions for gh-cli commands
 * - Ambiguity detection with user prompts
 * - Tool filtering to prevent unauthorized operations
 */

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

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
}

// Pre-granted bash commands (no confirmation required)
const PRE_GRANTED_COMMANDS = [
  /^gh issue create/,
  /^gh issue list/,
  /^gh issue view/,
  /^gh api/,
  /^gh repo view/,
  /^git remote get-url/,
  /^mkdir -p \.tmp/,
  /^touch \.tmp\//,
  /^cat \.tmp\//,
  /^ls \.tmp\//,
];

// Blocked commands (always require confirmation or are blocked)
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

// Read-only tools allowed during planning phases
const READONLY_TOOLS = ["read", "grep", "find", "ls", "bash", "subagent"];
const FULL_TOOLS = ["read", "grep", "find", "ls", "bash", "subagent", "write", "edit"];

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

export default function planningOrchestrator(pi: ExtensionAPI): void {
  let workflow: WorkflowData = {
    state: "IDLE",
    userRequest: "",
    planApproved: false,
    currentPhase: "IDLE",
    startTime: Date.now(),
  };

  // Register flag for starting in plan mode
  pi.registerFlag("plan", {
    description: "Start in planning workflow mode",
    type: "boolean",
    default: false,
  });

  // Status update helper
  function updateStatus(ctx: ExtensionContext): void {
    ctx.ui.setStatus("planning-workflow", ctx.ui.theme.fg("accent", getStateDisplay(workflow.state)));
  }

  // Persist workflow state
  function persistState(): void {
    pi.appendEntry("planning-workflow", {
      state: workflow.state,
      userRequest: workflow.userRequest,
      planApproved: workflow.planApproved,
      currentPhase: workflow.currentPhase,
    });
  }

  // ============ CUSTOM TOOLS ============

  // Tool 1: plan - Entry point to start workflow
  pi.registerTool({
    name: "plan",
    label: "Plan",
    description: "Start the planning workflow. Takes a user request and begins the RESEARCHER → PLANNER → ORGANIZER sequence.",
    parameters: Type.Object({
      request: Type.String({ description: "The feature, project, or task to plan" }),
    }),

    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (workflow.state !== "IDLE" && workflow.state !== "COMPLETE") {
        return {
          content: [
            {
              type: "text",
              text: `❌ Workflow already in progress (state: ${workflow.state}). Complete current workflow or use /reset-plan to start fresh.`,
            },
          ],
          isError: true,
        };
      }

      workflow = {
        state: "RESEARCHING",
        userRequest: params.request,
        planApproved: false,
        currentPhase: "RESEARCHING",
        startTime: Date.now(),
      };

      updateStatus(ctx);
      persistState();

      // Transition to PLANNING phase - invoke RESEARCHER subagent
      return {
        content: [
          {
            type: "text",
            text: `🎯 Starting planning workflow for: "${params.request}"\n\n📋 Workflow: RESEARCHER → PLANNER → [USER APPROVAL] → ORGANIZER\n\n🔍 Phase 1: RESEARCHER - Verifying official documentation...\n\nInvoking RESEARCHER subagent to gather official documentation and evaluate the tech stack.`,
          },
        ],
      };
    },
  });

  // Tool 2: approve_plan - User approval gate
  pi.registerTool({
    name: "approve_plan",
    label: "Approve Plan",
    description: "Approve the generated PLAN.md and proceed to ORGANIZER phase. Must be called after PLAN.md is generated.",
    parameters: Type.Object({
      approved: Type.Boolean({ description: "Set to true to approve the plan" }),
      feedback: Type.Optional(Type.String({ description: "Feedback or changes requested if not approving" })),
    }),

    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (workflow.state !== "PENDING_APPROVAL") {
        return {
          content: [
            {
              type: "text",
              text: `❌ Cannot approve: Workflow is in ${workflow.state} state. Must be in PENDING_APPROVAL state.`,
            },
          ],
          isError: true,
        };
      }

      if (!params.approved) {
        // User did not approve - return to PLANNING with feedback
        workflow.state = "PLANNING";
        workflow.currentPhase = "PLANNING";
        updateStatus(ctx);
        persistState();

        return {
          content: [
            {
              type: "text",
              text: `🔄 Plan not approved. Returning to PLANNING phase.\n\n📣 User Feedback: ${params.feedback || "No feedback provided - please revise the plan."}\n\nThe PLANNER will regenerate the plan incorporating your feedback.`,
            },
          ],
        };
      }

      // User approved - proceed to ORGANIZING
      workflow.state = "ORGANIZING";
      workflow.planApproved = true;
      workflow.currentPhase = "ORGANIZING";
      updateStatus(ctx);
      persistState();

      return {
        content: [
          {
            type: "text",
            text: `✅ Plan approved! Proceeding to ORGANIZER phase...\n\n📋 Creating GitHub issues from the approved plan.`,
          },
        ],
      };
    },
  });

  // Tool 3: ask_user - Ambiguity resolution
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
          content: [
            {
              type: "text",
              text: `❌ Cannot ask user: No UI available in non-interactive mode.`,
            },
          ],
          isError: true,
        };
      }

      const fullQuestion = params.context
        ? `❓ Clarification needed:\n\n${params.question}\n\nContext: ${params.context}`
        : `❓ Clarification needed:\n\n${params.question}`;

      const response = await ctx.ui.editor("Clarification Required", fullQuestion);

      if (!response || !response.trim()) {
        return {
          content: [
            {
              type: "text",
              text: `⏸️ No response provided. Please answer the question to proceed with planning.`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: `✅ User clarification received:\n${response}`,
          },
        ],
      };
    },
  });

  // Tool 4: complete_research - Transition from RESEARCHING to PLANNING
  pi.registerTool({
    name: "complete_research",
    label: "Complete Research",
    description: "Called by RESEARCHER to complete the research phase and transition to PLANNING.",
    parameters: Type.Object({
      prePlanPath: Type.String({ description: "Path to the generated pre-plan.md file", default: ".tmp/pre-plan.md" }),
    }),

    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (workflow.state !== "RESEARCHING") {
        return {
          content: [
            {
              type: "text",
              text: `❌ Cannot complete research: Workflow is in ${workflow.state} state.`,
            },
          ],
          isError: true,
        };
      }

      // Read the pre-plan content
      try {
        const fs = await import("node:fs");
        if (fs.existsSync(params.prePlanPath)) {
          workflow.prePlanContent = fs.readFileSync(params.prePlanPath, "utf-8");
        }
      } catch {
        // Ignore read errors
      }

      workflow.state = "PLANNING";
      workflow.currentPhase = "PLANNING";
      updateStatus(ctx);
      persistState();

      return {
        content: [
          {
            type: "text",
            text: `✅ Research complete!\n\n📝 Phase 2: PLANNER - Generating implementation plan...\n\nUsing pre-plan from: ${params.prePlanPath}\n\n⚠️ IMPORTANT: The PLANNER will:\n- Generate a detailed PLAN.md\n- NEVER write implementation code\n- Ask for clarification if requirements are ambiguous\n- Reference official documentation from the pre-plan`,
          },
        ],
      };
    },
  });

  // Tool 5: submit_plan - Transition from PLANNING to PENDING_APPROVAL
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
          content: [
            {
              type: "text",
              text: `❌ Cannot submit plan: Workflow is in ${workflow.state} state.`,
            },
          ],
          isError: true,
        };
      }

      // Read the plan content
      try {
        const fs = await import("node:fs");
        if (fs.existsSync(params.planPath)) {
          workflow.planContent = fs.readFileSync(params.planPath, "utf-8");
        }
      } catch {
        // Ignore read errors
      }

      workflow.state = "PENDING_APPROVAL";
      workflow.currentPhase = "PENDING_APPROVAL";
      updateStatus(ctx);
      persistState();

      const planPreview = workflow.planContent
        ? workflow.planContent.substring(0, 500) + (workflow.planContent.length > 500 ? "\n..." : "")
        : "(Plan content not available)";

      return {
        content: [
          {
            type: "text",
            text: `🎯 PLAN.md Generated!\n\n📄 Location: ${params.planPath}\n\n📝 Preview:\n${"─".repeat(60)}\n${planPreview}\n${"─".repeat(60)}\n\n⏳ **HARD STOP: USER APPROVAL REQUIRED**\n\nTo proceed:\n1. Review the PLAN.md file\n2. Use "/approve_plan approved=true" to approve\n3. Or use "/approve_plan approved=false feedback='...'" to request changes\n\n⚠️ The ORGANIZER will NOT run until you explicitly approve the plan.`,
          },
        ],
      };
    },
  });

  // Tool 6: complete_workflow - Mark workflow as complete
  pi.registerTool({
    name: "complete_workflow",
    label: "Complete Workflow",
    description: "Called by ORGANIZER to mark the workflow as complete after creating GitHub issues.",
    parameters: Type.Object({
      issuesCreated: Type.Number({ description: "Number of GitHub issues created" }),
      summary: Type.Optional(Type.String({ description: "Summary of created issues" })),
    }),

    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (workflow.state !== "ORGANIZING") {
        return {
          content: [
            {
              type: "text",
              text: `❌ Cannot complete workflow: Not in ORGANIZING state (current: ${workflow.state}).`,
            },
          ],
          isError: true,
        };
      }

      const duration = Math.round((Date.now() - workflow.startTime) / 1000);

      workflow.state = "COMPLETE";
      workflow.currentPhase = "COMPLETE";
      updateStatus(ctx);
      persistState();

      // Restore full tool access
      pi.setActiveTools(FULL_TOOLS);

      return {
        content: [
          {
            type: "text",
            text: `🎉 Planning Workflow Complete!\n\n✅ Issues Created: ${params.issuesCreated}\n⏱️ Duration: ${duration}s\n\n${params.summary || ""}\n\n📋 Next Steps:\n1. Review created GitHub issues\n2. Begin implementation following PLAN.md\n3. Use "/plan" to start a new planning workflow\n\n💡 You can now use all Pi tools for implementation.`,
          },
        ],
      };
    },
  });

  // Tool 7: reset_plan - Emergency reset
  pi.registerCommand("reset-plan", {
    description: "Reset the planning workflow to IDLE state",
    handler: async (_args, ctx) => {
      workflow = {
        state: "IDLE",
        userRequest: "",
        planApproved: false,
        currentPhase: "IDLE",
        startTime: Date.now(),
      };
      pi.setActiveTools(FULL_TOOLS);
      updateStatus(ctx);
      persistState();
      ctx.ui.notify("Planning workflow reset to IDLE state", "info");
    },
  });

  // Tool 8: status - Show current workflow status
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
      `.trim();
      ctx.ui.notify(status, "info");
    },
  });

  // ============ EVENT HANDLERS ============

  // Filter bash commands based on workflow state and pre-granted permissions
  pi.on("tool_call", async (event) => {
    if (event.toolName !== "bash") return undefined;

    const command = event.input.command as string;

    // Always block dangerous commands
    if (isBlockedCommand(command)) {
      return {
        block: true,
        reason: `🚫 Command blocked by planning workflow: "${command}"\n\nThis command is not allowed during the planning phase.`,
      };
    }

    // Check pre-granted permissions
    if (isPreGrantedCommand(command)) {
      return undefined; // Allow without confirmation
    }

    // During RESEARCHING and PLANNING phases, restrict bash usage
    if (workflow.state === "RESEARCHING" || workflow.state === "PLANNING") {
      // Only allow read-only commands and pre-granted commands
      const readOnlyPatterns = [
        /^(cat|head|tail|less|more)\b/,
        /^(grep|find|ls|pwd|tree)\b/,
        /^git\s+(status|log|diff|branch|remote)\b/,
        /^(npm|yarn|pnpm)\s+list\b/,
      ];

      const isReadOnly = readOnlyPatterns.some((p) => p.test(command));

      if (!isReadOnly) {
        return {
          block: true,
          reason: `⏸️ Command blocked in ${workflow.state} phase: "${command}"\n\nDuring ${workflow.state.toLowerCase()}, only read-only and pre-granted commands are allowed.\n\nAllowed: cat, grep, find, ls, git status/log/diff, gh issue create/list\n\nUse "/reset-plan" to exit planning mode if needed.`,
        };
      }
    }

    return undefined; // Allow the command
  });

  // Inject phase-specific context before agent starts
  pi.on("before_agent_start", async () => {
    if (workflow.state === "RESEARCHING") {
      return {
        message: {
          customType: "planning-context",
          content: `[PLANNING WORKFLOW: RESEARCHER PHASE]

You are the RESEARCHER agent in a strict planning workflow.

YOUR MISSION:
1. Use the brave-search skill to find OFFICIAL documentation only
2. Explicitly REJECT: Medium, StackOverflow, dev.to, blog posts
3. ACCEPT ONLY: Official API docs, GitHub repos, package READMEs, documentation sites

RESEARCH REQUIREMENTS:
- Verify all API authentication requirements against official docs (NEVER assume)
- Evaluate tech stack compatibility and potential failure points
- Document official documentation links consulted

OUTPUT:
Create .tmp/pre-plan.md with:
- Verified Technology Stack
- API Authentication Requirements (with official doc verification)
- Potential Risks and Blockers
- Official Documentation Links Consulted

When complete, call the complete_research tool to transition to PLANNING phase.

⚠️ CRITICAL: Do NOT proceed to planning without rigorous documentation verification.`,
          display: false,
        },
      };
    }

    if (workflow.state === "PLANNING") {
      return {
        message: {
          customType: "planning-context",
          content: `[PLANNING WORKFLOW: PLANNER PHASE]

You are the PLANNER agent in a strict planning workflow.

YOUR MISSION:
Generate a detailed PLAN.md for implementation.

STRICT CONSTRAINTS:
1. NEVER write implementation code - planning only
2. If requirements are ambiguous, use the ask_user tool for clarification
3. Reference official documentation from the pre-plan (NEVER assume)
4. Include step-by-step implementation guide

OUTPUT:
Create .tmp/PLAN.md with:
- Project/Feature Overview
- Step-by-Step Implementation Guide
- API References (linking to official docs)
- Anti-Patterns to Avoid
- Testing Strategy
- Rollback Procedures

When complete, call the submit_plan tool to request user approval.

⚠️ CRITICAL: This is a HARD STOP - you cannot proceed to ORGANIZER without explicit user approval.`,
          display: false,
        },
      };
    }

    if (workflow.state === "ORGANIZING") {
      return {
        message: {
          customType: "planning-context",
          content: `[PLANNING WORKFLOW: ORGANIZER PHASE]

You are the ORGANIZER agent in a strict planning workflow.

YOUR MISSION:
Create GitHub issues from the approved PLAN.md.

PRE-GRANTED PERMISSIONS:
You can execute these commands WITHOUT confirmation:
- gh issue create
- gh issue list
- gh api
- gh repo view

WORKFLOW:
1. Read the approved PLAN.md from .tmp/PLAN.md
2. Parse for features, stories, and tasks
3. Create hierarchical GitHub issues:
   - Features (parent issues)
   - Stories (child of features)
   - Tasks (child of stories)
4. Use templates from .pi/prompts/issue-templates/

When complete, call the complete_workflow tool with the number of issues created.

✅ User has explicitly approved the plan - proceed with issue creation.`,
          display: false,
        },
      };
    }

    return undefined;
  });

  // Handle workflow state on session start/resume
  pi.on("session_start", async (_event, ctx) => {
    // Check if flag was set
    if (pi.getFlag("plan") === true) {
      ctx.ui.notify("Planning workflow mode active. Use /plan <request> to start.", "info");
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
      };
    }

    updateStatus(ctx);
  });

  // Initialize status on extension load
  pi.on("extension_load", async (_event, ctx) => {
    updateStatus(ctx);
  });
}
