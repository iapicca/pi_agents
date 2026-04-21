/**
 * Coding Orchestrator Extension
 *
 * Enforces a strict coding workflow for implementing GitHub issues:
 * 1. Parse issue URL and determine type (feature/story/task)
 * 2. Create feature branch: feat/<number>-<slug>
 * 3. For each task (in semantic versioning order):
 *    a. Create task branch from feature branch
 *    b. IMPLEMENTATION PLANNER analyzes codebase and writes IMPLEMENTATION.md
 *    c. CODER reads IMPLEMENTATION.md and writes/edits code
 *    d. Run first-party linter
 *    e. PR-WRITER commits, pushes, creates PR to feature branch, merges automatically
 *    f. Clean .tmp
 *
 * Features:
 * - State machine tracking coding phases
 * - Tool filtering with pre-granted git/gh/linter permissions
 * - Phase-specific context injection for subagents
 */

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

type CodingState =
  | "IDLE"
  | "FETCHING_ISSUE"
  | "PLANNING_IMPLEMENTATION"
  | "CODING"
  | "LINTING"
  | "CREATING_PR"
  | "COMPLETE_TASK"
  | "COMPLETE_ALL";

interface TaskInfo {
  number: number;
  title: string;
  version: string;
}

interface CodingWorkflowData {
  state: CodingState;
  issueUrl: string;
  issueNumber: number;
  issueType: "feature" | "story" | "task" | "unknown";
  featureBranch: string;
  currentTaskIndex: number;
  totalTasks: number;
  tasks: TaskInfo[];
  repoOwner: string;
  repoName: string;
  startTime: number;
}

// Pre-granted bash commands for coding workflow (no confirmation required)
const PRE_GRANTED_COMMANDS = [
  /^gh issue view\b/,
  /^gh issue list\b/,
  /^gh pr create\b/,
  /^gh pr merge\b/,
  /^gh pr view\b/,
  /^gh api\b/,
  /^gh repo view\b/,
  /^git checkout -b\b/,
  /^git checkout\b/,
  /^git branch\b/,
  /^git add\b/,
  /^git commit\b/,
  /^git push\b/,
  /^git pull\b/,
  /^git fetch\b/,
  /^git status\b/,
  /^git log\b/,
  /^git diff\b/,
  /^git remote\b/,
  /^git merge\b/,
  /^git rebase\b/,
  /^mkdir -p \.tmp/,
  /^rm -rf \.tmp\//,
  /^ls \.tmp\//,
  /^cat \.tmp\//,
  /^touch \.tmp\//,
  /^npm run lint\b/,
  /^npm run fix\b/,
  /^pnpm lint\b/,
  /^pnpm fix\b/,
  /^yarn lint\b/,
  /^yarn fix\b/,
  /^cargo clippy\b/,
  /^cargo fmt\b/,
  /^ruff check\b/,
  /^ruff format\b/,
  /^black\b/,
  /^flake8\b/,
  /^eslint\b/,
  /^prettier\b/,
  /^tsc --noEmit\b/,
  /^go fmt\b/,
  /^go vet\b/,
  /^dart analyze\b/,
  /^python -m compileall\b/,
];

// Blocked commands (always blocked)
const BLOCKED_COMMANDS = [
  /^rm -rf \/\b/,
  /^sudo\b/,
  /^chmod\b.*777/,
  /^chown\b/,
];

function isPreGrantedCommand(command: string): boolean {
  return PRE_GRANTED_COMMANDS.some((pattern) => pattern.test(command));
}

function isBlockedCommand(command: string): boolean {
  return BLOCKED_COMMANDS.some((pattern) => pattern.test(command));
}

function getStateDisplay(state: CodingState): string {
  const displays: Record<CodingState, string> = {
    IDLE: "⏸ Idle - Ready to code",
    FETCHING_ISSUE: "📥 Fetching issue details",
    PLANNING_IMPLEMENTATION: "📝 Planning implementation",
    CODING: "💻 Writing code",
    LINTING: "🔍 Running linter",
    CREATING_PR: "🚀 Creating PR",
    COMPLETE_TASK: "✅ Task complete",
    COMPLETE_ALL: "🎉 All tasks complete",
  };
  return displays[state];
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

export default function codingOrchestrator(pi: ExtensionAPI): void {
  let workflow: CodingWorkflowData = {
    state: "IDLE",
    issueUrl: "",
    issueNumber: 0,
    issueType: "unknown",
    featureBranch: "",
    currentTaskIndex: 0,
    totalTasks: 0,
    tasks: [],
    repoOwner: "",
    repoName: "",
    startTime: Date.now(),
  };

  pi.registerFlag("code", {
    description: "Start in coding workflow mode",
    type: "boolean",
    default: false,
  });

  function updateStatus(ctx: ExtensionContext): void {
    ctx.ui.setStatus(
      "coding-workflow",
      ctx.ui.theme.fg("accent", getStateDisplay(workflow.state))
    );
  }

  function persistState(): void {
    pi.appendEntry("coding-workflow", {
      state: workflow.state,
      issueUrl: workflow.issueUrl,
      issueNumber: workflow.issueNumber,
      issueType: workflow.issueType,
      featureBranch: workflow.featureBranch,
      currentTaskIndex: workflow.currentTaskIndex,
      totalTasks: workflow.totalTasks,
      tasks: workflow.tasks,
      repoOwner: workflow.repoOwner,
      repoName: workflow.repoName,
    });
  }

  // ============ CUSTOM TOOLS ============

  // Tool: code - Entry point
  pi.registerTool({
    name: "code",
    label: "Code",
    description:
      "Start the coding workflow. Takes a GitHub issue URL, creates a feature branch, and iterates through all tasks in semantic versioning order.",
    parameters: Type.Object({
      issueUrl: Type.String({ description: "GitHub issue URL to implement" }),
    }),

    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (workflow.state !== "IDLE" && workflow.state !== "COMPLETE_ALL") {
        return {
          content: [
            {
              type: "text",
              text: `❌ Coding workflow already in progress (state: ${workflow.state}). Complete current workflow or use /reset-code to start fresh.`,
            },
          ],
          isError: true,
        };
      }

      // Parse issue URL: https://github.com/owner/repo/issues/123
      const match = params.issueUrl.match(/github\.com\/([^/]+)\/([^/]+)\/(?:issues|pull)\/(\d+)/);
      if (!match) {
        return {
          content: [
            {
              type: "text",
              text: `❌ Invalid issue URL: "${params.issueUrl}". Expected format: https://github.com/owner/repo/issues/123`,
            },
          ],
          isError: true,
        };
      }

      const [, owner, repo, numberStr] = match;
      const issueNumber = parseInt(numberStr, 10);

      workflow = {
        state: "FETCHING_ISSUE",
        issueUrl: params.issueUrl,
        issueNumber,
        issueType: "unknown",
        featureBranch: "",
        currentTaskIndex: 0,
        totalTasks: 0,
        tasks: [],
        repoOwner: owner,
        repoName: repo,
        startTime: Date.now(),
      };

      updateStatus(ctx);
      persistState();

      return {
        content: [
          {
            type: "text",
            text: `🎯 Starting coding workflow for issue #${issueNumber}\n\n🔗 ${params.issueUrl}\n\nWorkflow:\n1. Fetch issue details (type: feature/story/task)\n2. Create feature branch\n3. For each task (in semver order):\n   a. IMPLEMENTATION PLANNER → .tmp/IMPLEMENTATION.md\n   b. CODER → write/edit code\n   c. Linter → validate\n   d. PR-WRITER → push, create PR, merge to feature branch\n4. Clean up\n\n📥 Fetching issue details...`,
          },
        ],
      };
    },
  });

  // Tool: submit_implementation - Transition from planner to coder
  pi.registerTool({
    name: "submit_implementation",
    label: "Submit Implementation",
    description: "Called by IMPLEMENTATION PLANNER to submit the completed IMPLEMENTATION.md.",
    parameters: Type.Object({
      implementationPath: Type.String({ default: ".tmp/IMPLEMENTATION.md" }),
    }),

    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (workflow.state !== "PLANNING_IMPLEMENTATION") {
        return {
          content: [
            {
              type: "text",
              text: `❌ Cannot submit implementation: Workflow is in ${workflow.state} state.`,
            },
          ],
          isError: true,
        };
      }

      workflow.state = "CODING";
      updateStatus(ctx);
      persistState();

      return {
        content: [
          {
            type: "text",
            text: `✅ Implementation plan submitted!\n\n📄 Location: ${params.implementationPath}\n\n💻 Phase: CODER - Writing code based on implementation plan...`,
          },
        ],
      };
    },
  });

  // Tool: complete_coding - Transition from coding to PR creation
  pi.registerTool({
    name: "complete_coding",
    label: "Complete Coding",
    description: "Called by CODER after writing code and running linter successfully.",
    parameters: Type.Object({}),

    async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
      if (workflow.state !== "CODING" && workflow.state !== "LINTING") {
        return {
          content: [
            {
              type: "text",
              text: `❌ Cannot complete coding: Workflow is in ${workflow.state} state.`,
            },
          ],
          isError: true,
        };
      }

      workflow.state = "CREATING_PR";
      updateStatus(ctx);
      persistState();

      return {
        content: [
          {
            type: "text",
            text: `✅ Coding complete and linter passed!\n\n🚀 Phase: PR-WRITER - Creating PR and merging to feature branch...`,
          },
        ],
      };
    },
  });

  // Tool: complete_pr - After PR is merged
  pi.registerTool({
    name: "complete_pr",
    label: "Complete PR",
    description: "Called by PR-WRITER after PR is created and merged to feature branch.",
    parameters: Type.Object({
      prUrl: Type.String({ description: "URL of the created and merged PR" }),
    }),

    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (workflow.state !== "CREATING_PR") {
        return {
          content: [
            {
              type: "text",
              text: `❌ Cannot complete PR: Workflow is in ${workflow.state} state.`,
            },
          ],
          isError: true,
        };
      }

      workflow.state = "COMPLETE_TASK";
      updateStatus(ctx);
      persistState();

      return {
        content: [
          {
            type: "text",
            text: `✅ PR merged!\n\n🔗 ${params.prUrl}\n\n🧹 Cleaning .tmp and preparing for next task...`,
          },
        ],
      };
    },
  });

  // Tool: next_task - Transition to next task or complete
  pi.registerTool({
    name: "next_task",
    label: "Next Task",
    description:
      "Transition to the next task in the iteration. Called by CODER agent after a task is fully processed.",
    parameters: Type.Object({
      taskCompleted: Type.Boolean({ description: "Whether the current task was completed successfully" }),
      prUrl: Type.Optional(Type.String({ description: "URL of the created PR" })),
    }),

    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (!params.taskCompleted) {
        workflow.state = "IDLE";
        updateStatus(ctx);
        persistState();
        return {
          content: [
            {
              type: "text",
              text: `❌ Task failed. Workflow halted. Fix the issue and restart with /code <issue-url>.`,
            },
          ],
          isError: true,
        };
      }

      workflow.currentTaskIndex++;

      if (workflow.currentTaskIndex >= workflow.totalTasks) {
        workflow.state = "COMPLETE_ALL";
        updateStatus(ctx);
        persistState();

        const duration = Math.round((Date.now() - workflow.startTime) / 1000);

        return {
          content: [
            {
              type: "text",
              text: `🎉 Coding Workflow Complete!\n\n✅ Tasks Completed: ${workflow.totalTasks}\n⏱️ Duration: ${duration}s\n📋 Feature Branch: \`${workflow.featureBranch}\`\n\nAll tasks have been implemented and merged to the feature branch.\nReview and merge \`${workflow.featureBranch}\` to main when ready.`,
            },
          ],
        };
      }

      const nextTask = workflow.tasks[workflow.currentTaskIndex];
      workflow.state = "PLANNING_IMPLEMENTATION";
      updateStatus(ctx);
      persistState();

      return {
        content: [
          {
            type: "text",
            text: `➡️ Moving to next task (${workflow.currentTaskIndex + 1}/${workflow.totalTasks})\n\nTask #${nextTask.number}: ${nextTask.title}\nVersion: ${nextTask.version}\n\n📝 Calling IMPLEMENTATION PLANNER...`,
          },
        ],
      };
    },
  });

  // ============ COMMANDS ============

  pi.registerCommand("code", {
    description: "Start the coding workflow for a GitHub issue",
    handler: async (args, ctx) => {
      const issueUrl = args.trim();
      if (!issueUrl) {
        ctx.ui.notify("Usage: /code <github-issue-url>", "error");
        return;
      }

      const result = await pi.invokeTool("code", { issueUrl });
      ctx.ui.notify(result.content[0].text, "info");
    },
  });

  pi.registerCommand("reset-code", {
    description: "Reset the coding workflow to IDLE state",
    handler: async (_args, ctx) => {
      workflow = {
        state: "IDLE",
        issueUrl: "",
        issueNumber: 0,
        issueType: "unknown",
        featureBranch: "",
        currentTaskIndex: 0,
        totalTasks: 0,
        tasks: [],
        repoOwner: "",
        repoName: "",
        startTime: Date.now(),
      };
      updateStatus(ctx);
      persistState();
      ctx.ui.notify("Coding workflow reset to IDLE state", "info");
    },
  });

  pi.registerCommand("code-status", {
    description: "Show current coding workflow status",
    handler: async (_args, ctx) => {
      const currentTask = workflow.tasks[workflow.currentTaskIndex];
      const status = `
📊 Coding Workflow Status
${"─".repeat(40)}
State: ${workflow.state}
Issue: #${workflow.issueNumber} (${workflow.issueType})
Feature Branch: ${workflow.featureBranch || "(not created)"}
Progress: ${workflow.currentTaskIndex}/${workflow.totalTasks} tasks
Current Task: ${currentTask ? `#${currentTask.number} ${currentTask.title}` : "(none)"}
      `.trim();
      ctx.ui.notify(status, "info");
    },
  });

  // ============ EVENT HANDLERS ============

  pi.on("tool_call", async (event) => {
    if (event.toolName !== "bash") return undefined;

    const command = event.input.command as string;

    if (isBlockedCommand(command)) {
      return {
        block: true,
        reason: `🚫 Command blocked by coding workflow: "${command}"\n\nThis command is not allowed during the coding workflow.`,
      };
    }

    if (isPreGrantedCommand(command)) {
      return undefined; // Allow without confirmation
    }

    // During coding phases, allow most bash commands (broader than planning)
    // but still require confirmation for potentially destructive operations
    const potentiallyDestructive = [
      /^rm\b/,
      /^mv\b/,
      /^cp\b.*-r/,
      /^(npm|yarn|pnpm) install\b/,
      /^pip install\b/,
      /^cargo install\b/,
      /^go get\b/,
    ];

    const isDestructive = potentiallyDestructive.some((p) => p.test(command));

    if (isDestructive && workflow.state !== "IDLE" && workflow.state !== "COMPLETE_ALL") {
      return {
        block: true,
        reason: `⏸️ Command requires confirmation in coding workflow: "${command}"\n\nThis command may modify the environment. Use /reset-code if you need to run it outside the workflow.`,
      };
    }

    return undefined;
  });

  pi.on("before_agent_start", async () => {
    if (workflow.state === "PLANNING_IMPLEMENTATION") {
      return {
        message: {
          customType: "coding-context",
          content: `[CODING WORKFLOW: IMPLEMENTATION PLANNER PHASE]

You are the IMPLEMENTATION PLANNER agent in a strict coding workflow.

YOUR MISSION:
1. Read the target task issue and its parent story/feature for context
2. Analyze the codebase to identify relevant files, APIs, and patterns
3. Investigate the best implementation strategy
4. Write a detailed IMPLEMENTATION.md in ./.tmp/

CONSTRAINTS:
- NEVER write implementation code
- Use ONLY official documentation and the existing codebase
- Identify the first-party linter command (e.g., npm run lint, cargo clippy)
- Verify no new dependencies are needed (unless stated in the issue)
- Be specific: name exact files, functions, and line numbers

OUTPUT:
Create .tmp/IMPLEMENTATION.md following the template in .pi/prompts/implementation.md

When complete, call submit_implementation tool.`,
          display: false,
        },
      };
    }

    if (workflow.state === "CODING") {
      return {
        message: {
          customType: "coding-context",
          content: `[CODING WORKFLOW: CODER PHASE]

You are the CODER agent in a strict coding workflow.

YOUR MISSION:
1. Read .tmp/IMPLEMENTATION.md
2. Write/edit/delete code as specified
3. Run the first-party linter identified in IMPLEMENTATION.md
4. Fix any linter errors before proceeding

CONSTRAINTS:
- Follow the implementation plan exactly
- Do not deviate from the issue requirements
- Do not introduce new dependencies (unless stated in the issue)
- Run linter and ensure it passes before proceeding
- Commit changes before invoking PR-WRITER

When code is complete and linter passes, call complete_coding tool.`,
          display: false,
        },
      };
    }

    if (workflow.state === "CREATING_PR") {
      return {
        message: {
          customType: "coding-context",
          content: `[CODING WORKFLOW: PR-WRITER PHASE]

You are the PR-WRITER agent in a strict coding workflow.

YOUR MISSION:
1. Commit all changes with a descriptive message
2. Push the task branch
3. Create a PR following the template in .pi/prompts/pr.md
4. Merge the PR to the feature branch automatically

PR BODY REQUIREMENTS:
- Always include "Fixes https://github.com/${workflow.repoOwner}/${workflow.repoName}/issues/<task_number>"
- If this is the LAST task of a story, ALSO include "Fixes https://github.com/${workflow.repoOwner}/${workflow.repoName}/issues/<story_number>"

When PR is merged, call complete_pr tool with the PR URL.`,
          display: false,
        },
      };
    }

    return undefined;
  });

  pi.on("session_start", async (_event, ctx) => {
    if (pi.getFlag("code") === true) {
      ctx.ui.notify("Coding workflow mode active. Use /code <issue-url> to start.", "info");
    }

    const entries = ctx.sessionManager.getEntries();
    const workflowEntry = entries
      .filter((e: { type: string; customType?: string }) => e.type === "custom" && e.customType === "coding-workflow")
      .pop() as { data?: CodingWorkflowData } | undefined;

    if (workflowEntry?.data) {
      workflow = {
        ...workflow,
        state: workflowEntry.data.state ?? workflow.state,
        issueUrl: workflowEntry.data.issueUrl ?? workflow.issueUrl,
        issueNumber: workflowEntry.data.issueNumber ?? workflow.issueNumber,
        issueType: workflowEntry.data.issueType ?? workflow.issueType,
        featureBranch: workflowEntry.data.featureBranch ?? workflow.featureBranch,
        currentTaskIndex: workflowEntry.data.currentTaskIndex ?? workflow.currentTaskIndex,
        totalTasks: workflowEntry.data.totalTasks ?? workflow.totalTasks,
        tasks: workflowEntry.data.tasks ?? workflow.tasks,
        repoOwner: workflowEntry.data.repoOwner ?? workflow.repoOwner,
        repoName: workflowEntry.data.repoName ?? workflow.repoName,
      };
    }

    updateStatus(ctx);
  });

  pi.on("extension_load", async (_event, ctx) => {
    updateStatus(ctx);
  });
}
