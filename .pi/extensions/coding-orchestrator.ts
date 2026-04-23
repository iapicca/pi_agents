/**
 * Coding Orchestrator Extension
 *
 * Enforces a strict coding workflow for implementing GitHub issues:
 * 1. Parse issue URL and determine type (feature/story/task)
 * 2. Create feature branch: feat/<number>-<slug>
 * 3. Create story branches: story/<number>.<minor>-<slug>
 * 4. Pre-planning phase: feature plan + story plans (upfront)
 * 5. For each task (in semantic versioning order):
 *    a. Create task branch from story branch
 *    b. IMPLEMENTATION PLANNER analyzes codebase and writes task-implementation-{N.M.P}.md
 *    c. CODER reads all 3 implementation files and writes/edits code
 *    d. Run first-party linter
 *    e. PR-WRITER commits, pushes, creates task PR to story branch, merges
 *    f. Check off task in story plan, delete task implementation file
 *    g. If last task of story: PR-WRITER creates story PR to feature branch, merges
 *    h. Check off story in feature plan, delete story implementation file
 *
 * Features:
 * - State machine tracking coding phases
 * - Tool filtering with pre-granted git/gh/linter permissions
 * - Phase-specific context injection for subagents
 */

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { readFileSync } from "node:fs";
import { join } from "node:path";

type CodingState =
  | "IDLE"
  | "FETCHING_ISSUE"
  | "PLANNING_FEATURE"
  | "PLANNING_STORIES"
  | "PLANNING_TASK"
  | "CODING"
  | "LINTING"
  | "CREATING_PR"
  | "COMPLETE_TASK"
  | "COMPLETE_ALL";

type PrType = "task" | "story" | "none";

interface TaskInfo {
  number: number;
  title: string;
  version: string;
  storyVersion: string;
}

interface StoryInfo {
  number: number;
  title: string;
  version: string;
  tasks: TaskInfo[];
}

interface CodingWorkflowData {
  state: CodingState;
  issueUrl: string;
  issueNumber: number;
  issueType: "feature" | "story" | "task" | "unknown";
  featureBranch: string;
  currentStoryIndex: number;
  currentTaskIndex: number;
  totalStories: number;
  totalTasks: number;
  stories: StoryInfo[];
  tasks: TaskInfo[];
  repoOwner: string;
  repoName: string;
  prType: PrType;
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
  /^rm \.tmp\//,
  /^ls \.tmp\//,
  /^cat \.tmp\//,
  /^touch \.tmp\//,
  /^sed -i/,
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
    PLANNING_FEATURE: "📝 Planning feature architecture",
    PLANNING_STORIES: "📝 Planning story strategies",
    PLANNING_TASK: "📝 Planning task implementation",
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

function loadPrompt(phase: string): string {
  const path = join(".pi/prompts/extensions/coding-orchestrator", `${phase}.md`);
  try {
    return readFileSync(path, "utf-8");
  } catch {
    return `[CODING WORKFLOW: ${phase.toUpperCase().replace(/-/g, " ")} PHASE]\n\n⚠️ Prompt file not found: ${path}`;
  }
}

export default function codingOrchestrator(pi: ExtensionAPI): void {
  let workflow: CodingWorkflowData = {
    state: "IDLE",
    issueUrl: "",
    issueNumber: 0,
    issueType: "unknown",
    featureBranch: "",
    currentStoryIndex: 0,
    currentTaskIndex: 0,
    totalStories: 0,
    totalTasks: 0,
    stories: [],
    tasks: [],
    repoOwner: "",
    repoName: "",
    prType: "none",
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
      currentStoryIndex: workflow.currentStoryIndex,
      currentTaskIndex: workflow.currentTaskIndex,
      totalStories: workflow.totalStories,
      totalTasks: workflow.totalTasks,
      stories: workflow.stories,
      tasks: workflow.tasks,
      repoOwner: workflow.repoOwner,
      repoName: workflow.repoName,
      prType: workflow.prType,
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
        currentStoryIndex: 0,
        currentTaskIndex: 0,
        totalStories: 0,
        totalTasks: 0,
        stories: [],
        tasks: [],
        repoOwner: owner,
        repoName: repo,
        prType: "none",
        startTime: Date.now(),
      };

      updateStatus(ctx);
      persistState();

      return {
        content: [
          {
            type: "text",
            text: `🎯 Starting coding workflow for issue #${issueNumber}\n\n🔗 ${params.issueUrl}\n\nWorkflow:\n1. Fetch issue details (type: feature/story/task)\n2. Create feature branch\n3. Pre-planning: feature architecture + story strategies\n4. For each task (in semver order):\n   a. IMPLEMENTATION PLANNER → task-implementation-{N.M.P}.md\n   b. CODER → write/edit code (loads all 3 impl files)\n   c. Linter → validate\n   d. PR-WRITER → push, create task PR, merge to story branch\n   e. If last task of story → story PR, merge to feature branch\n5. Clean up\n\n📥 Fetching issue details...`,
          },
        ],
      };
    },
  });

  // Tool: submit_feature_plan - Transition from feature planning to story planning
  pi.registerTool({
    name: "submit_feature_plan",
    label: "Submit Feature Plan",
    description: "Called by IMPLEMENTATION PLANNER to submit the completed feature implementation plan.",
    parameters: Type.Object({
      planPath: Type.String({ default: ".tmp/feat-implementation-{N}.md" }),
    }),

    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (workflow.state !== "PLANNING_FEATURE") {
        return {
          content: [
            {
              type: "text",
              text: `❌ Cannot submit feature plan: Workflow is in ${workflow.state} state.`,
            },
          ],
          isError: true,
        };
      }

      workflow.state = "PLANNING_STORIES";
      updateStatus(ctx);
      persistState();

      return {
        content: [
          {
            type: "text",
            text: `✅ Feature plan submitted!\n\n📄 Location: ${params.planPath}\n\n📝 Phase: Planning story strategies...`,
          },
        ],
      };
    },
  });

  // Tool: submit_story_plan - Transition from story planning to next story or task planning
  pi.registerTool({
    name: "submit_story_plan",
    label: "Submit Story Plan",
    description: "Called by IMPLEMENTATION PLANNER to submit a completed story implementation plan.",
    parameters: Type.Object({
      planPath: Type.String({ default: ".tmp/story-implementation-{N.M}.md" }),
      isLastStory: Type.Boolean({ default: false, description: "Whether this is the last story to plan" }),
    }),

    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (workflow.state !== "PLANNING_STORIES") {
        return {
          content: [
            {
              type: "text",
              text: `❌ Cannot submit story plan: Workflow is in ${workflow.state} state.`,
            },
          ],
          isError: true,
        };
      }

      if (params.isLastStory) {
        workflow.state = "PLANNING_TASK";
        updateStatus(ctx);
        persistState();

        return {
          content: [
            {
              type: "text",
              text: `✅ All story plans submitted!\n\n📄 Last story plan: ${params.planPath}\n\n📝 Phase: Planning first task implementation...`,
            },
          ],
        };
      }

      // More stories to plan - stay in PLANNING_STORIES
      workflow.currentStoryIndex++;
      updateStatus(ctx);
      persistState();

      return {
        content: [
          {
            type: "text",
            text: `✅ Story plan submitted!\n\n📄 Location: ${params.planPath}\n\n📝 Phase: Planning next story strategy...`,
          },
        ],
      };
    },
  });

  // Tool: submit_task_plan - Transition from task planner to coder
  pi.registerTool({
    name: "submit_task_plan",
    label: "Submit Task Plan",
    description: "Called by IMPLEMENTATION PLANNER to submit the completed task implementation plan.",
    parameters: Type.Object({
      planPath: Type.String({ default: ".tmp/task-implementation-{N.M.P}.md" }),
    }),

    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (workflow.state !== "PLANNING_TASK") {
        return {
          content: [
            {
              type: "text",
              text: `❌ Cannot submit task plan: Workflow is in ${workflow.state} state.`,
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
            text: `✅ Task plan submitted!\n\n📄 Location: ${params.planPath}\n\n💻 Phase: CODER - Writing code based on implementation plan (loading feat + story + task plans)...`,
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
            text: `✅ Coding complete and linter passed!\n\n🚀 Phase: PR-WRITER - Creating PR and merging...`,
          },
        ],
      };
    },
  });

  // Tool: complete_pr - After PR is merged
  pi.registerTool({
    name: "complete_pr",
    label: "Complete PR",
    description: "Called by PR-WRITER after PR is created and merged.",
    parameters: Type.Object({
      prUrl: Type.String({ description: "URL of the created and merged PR" }),
      prType: Type.String({ description: "Type of PR: task or story", default: "task" }),
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

      if (params.prType === "story") {
        // Story PR merged - story is complete
        workflow.state = "COMPLETE_TASK";
        workflow.prType = "none";
        updateStatus(ctx);
        persistState();

        return {
          content: [
            {
              type: "text",
              text: `✅ Story PR merged!\n\n🔗 ${params.prUrl}\n\n🧹 Story branch merged to feature branch. Preparing for next task...`,
            },
          ],
        };
      }

      // Task PR merged
      workflow.state = "COMPLETE_TASK";
      workflow.prType = "none";
      updateStatus(ctx);
      persistState();

      return {
        content: [
          {
            type: "text",
            text: `✅ Task PR merged!\n\n🔗 ${params.prUrl}\n\n🧹 Task implementation file cleaned. Preparing for next task...`,
          },
        ],
      };
    },
  });

  // Tool: next_task - Transition to next task, story PR, or complete
  pi.registerTool({
    name: "next_task",
    label: "Next Task",
    description:
      "Transition to the next task in the iteration, or trigger story PR creation, or complete. Called by CODER agent after a task is fully processed.",
    parameters: Type.Object({
      taskCompleted: Type.Boolean({ description: "Whether the current task was completed successfully" }),
      isLastTaskOfStory: Type.Boolean({ description: "Whether this was the last task of the current story", default: false }),
      prUrl: Type.Optional(Type.String({ description: "URL of the created task PR" })),
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

      // Check if all tasks are complete
      if (workflow.currentTaskIndex >= workflow.totalTasks) {
        workflow.state = "COMPLETE_ALL";
        updateStatus(ctx);
        persistState();

        const duration = Math.round((Date.now() - workflow.startTime) / 1000);

        return {
          content: [
            {
              type: "text",
              text: `🎉 Coding Workflow Complete!\n\n✅ Stories Completed: ${workflow.totalStories}\n✅ Tasks Completed: ${workflow.totalTasks}\n⏱️ Duration: ${duration}s\n📋 Feature Branch: \`${workflow.featureBranch}\`\n\nAll stories and tasks have been implemented and merged to the feature branch.\nReview and merge \`${workflow.featureBranch}\` to main when ready.`,
            },
          ],
        };
      }

      // If last task of story, trigger story PR creation
      if (params.isLastTaskOfStory) {
        workflow.state = "CREATING_PR";
        workflow.prType = "story";
        updateStatus(ctx);
        persistState();

        return {
          content: [
            {
              type: "text",
              text: `➡️ Last task of story completed!\n\n🚀 Phase: PR-WRITER - Creating story PR and merging to feature branch...`,
            },
          ],
        };
      }

      // More tasks to process
      const nextTask = workflow.tasks[workflow.currentTaskIndex];
      workflow.state = "PLANNING_TASK";
      workflow.prType = "none";
      updateStatus(ctx);
      persistState();

      return {
        content: [
          {
            type: "text",
            text: `➡️ Moving to next task (${workflow.currentTaskIndex + 1}/${workflow.totalTasks})\n\nTask #${nextTask.number}: ${nextTask.title}\nVersion: ${nextTask.version}\n\n📝 Calling IMPLEMENTATION PLANNER for task-level plan...`,
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
        currentStoryIndex: 0,
        currentTaskIndex: 0,
        totalStories: 0,
        totalTasks: 0,
        stories: [],
        tasks: [],
        repoOwner: "",
        repoName: "",
        prType: "none",
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
      const currentStory = workflow.stories[workflow.currentStoryIndex];
      const status = `
📊 Coding Workflow Status
${"─".repeat(40)}
State: ${workflow.state}
PR Type: ${workflow.prType}
Issue: #${workflow.issueNumber} (${workflow.issueType})
Feature Branch: ${workflow.featureBranch || "(not created)"}
Stories: ${workflow.currentStoryIndex}/${workflow.totalStories}
Tasks: ${workflow.currentTaskIndex}/${workflow.totalTasks}
Current Story: ${currentStory ? `#${currentStory.number} ${currentStory.title}` : "(none)"}
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
    if (workflow.state === "PLANNING_FEATURE") {
      return {
        message: {
          customType: "coding-context",
          content: loadPrompt("planning-feature-phase"),
          display: false,
        },
      };
    }

    if (workflow.state === "PLANNING_STORIES") {
      return {
        message: {
          customType: "coding-context",
          content: loadPrompt("planning-stories-phase"),
          display: false,
        },
      };
    }

    if (workflow.state === "PLANNING_TASK") {
      return {
        message: {
          customType: "coding-context",
          content: loadPrompt("planning-task-phase"),
          display: false,
        },
      };
    }

    if (workflow.state === "CODING") {
      return {
        message: {
          customType: "coding-context",
          content: loadPrompt("coding-phase"),
          display: false,
        },
      };
    }

    if (workflow.state === "CREATING_PR") {
      if (workflow.prType === "story") {
        return {
          message: {
            customType: "coding-context",
            content: loadPrompt("creating-pr-story-phase").replace(
              /\{OWNER\}/g,
              workflow.repoOwner
            ).replace(
              /\{REPO\}/g,
              workflow.repoName
            ),
            display: false,
          },
        };
      }

      return {
        message: {
          customType: "coding-context",
          content: loadPrompt("creating-pr-task-phase").replace(
            /\{OWNER\}/g,
            workflow.repoOwner
          ).replace(
            /\{REPO\}/g,
            workflow.repoName
          ),
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
        currentStoryIndex: workflowEntry.data.currentStoryIndex ?? workflow.currentStoryIndex,
        currentTaskIndex: workflowEntry.data.currentTaskIndex ?? workflow.currentTaskIndex,
        totalStories: workflowEntry.data.totalStories ?? workflow.totalStories,
        totalTasks: workflowEntry.data.totalTasks ?? workflow.totalTasks,
        stories: workflowEntry.data.stories ?? workflow.stories,
        tasks: workflowEntry.data.tasks ?? workflow.tasks,
        repoOwner: workflowEntry.data.repoOwner ?? workflow.repoOwner,
        repoName: workflowEntry.data.repoName ?? workflow.repoName,
        prType: workflowEntry.data.prType ?? workflow.prType,
      };
    }

    updateStatus(ctx);
  });

  pi.on("extension_load", async (_event, ctx) => {
    updateStatus(ctx);
  });
}
