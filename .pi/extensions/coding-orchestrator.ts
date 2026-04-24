/**
 * Coding Orchestrator Extension — Strategy C (Hybrid Enforcement)
 *
 * Enforces a strict coding workflow with iterative task execution:
 * IDLE → FETCHING_ISSUE → PLANNING_FEATURE → PLANNING_STORIES → PLANNING_TASK →
 * CODING → CREATING_PR → COMPLETE_TASK → (loop) → COMPLETE_ALL
 *
 * Key changes from previous version:
 * - Command-driven entry point (/code)
 * - Extension auto-spawns IMPLEMENTATION PLANNER and PR-WRITER
 * - Extension handles branch creation and issue fetching
 * - pi.setActiveTools() mechanically restricts tools per phase
 * - Path-based blocking: write/edit outside .tmp/ forbidden during planning phases
 * - Git main/master protection during CODING
 * - Fully sequential — no parallelism
 */

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runBash, ghIssueView, ghIssueList, spawnSubagent } from "./helpers/workflow-helpers.js";

type CodingState =
  | "IDLE"
  | "FETCHING_ISSUE"
  | "PLANNING_FEATURE"
  | "PLANNING_STORIES"
  | "PLANNING_TASK"
  | "CODING"
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

// ── Tool sets for setActiveTools() ───────────────────────────────────────────

const READONLY_TOOLS = ["read", "grep", "find", "ls", "bash", "webfetch"];

const PLANNING_TOOLS = ["read", "grep", "find", "ls", "bash", "write", "edit", "webfetch"];

const CODING_TOOLS = ["read", "grep", "find", "ls", "bash", "write", "edit", "subagent"];

const PR_TOOLS = ["read", "bash", "gh_pr_create", "gh_pr_merge", "gh_pr_view"];

const FULL_TOOLS = [
  "read", "grep", "find", "ls", "bash", "subagent", "write", "edit",
  "gh_issue_create", "gh_issue_list", "gh_issue_view",
  "gh_pr_create", "gh_pr_merge", "gh_pr_view",
  "gh_repo_view", "gh_api", "gh_remote_url",
  "complete_coding", "webfetch",
];

// ── Pre-granted bash commands (no confirmation) ──────────────────────────────
// NOTE: No raw `gh` CLI commands here. Agents MUST use gh-extension tools.

const PRE_GRANTED_COMMANDS = [
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
  /^touch \.tmp\//,
  /^cat \.tmp\//,
  /^ls \.tmp\//,
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

function extractVersion(title: string): string {
  const match = title.match(/\[(\d+(?:\.\d+)?(?:\.\d+)?)\]/);
  return match ? match[1] : "0";
}

function compareVersions(a: string, b: string): number {
  const aParts = a.split(".").map(Number);
  const bParts = b.split(".").map(Number);
  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const aNum = aParts[i] || 0;
    const bNum = bParts[i] || 0;
    if (aNum !== bNum) return aNum - bNum;
  }
  return 0;
}

// ── Main extension ───────────────────────────────────────────────────────────

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
    ctx.ui.setStatus("coding-workflow", ctx.ui.theme.fg("accent", getStateDisplay(workflow.state)));
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

  async function ensureBranch(branch: string, base: string): Promise<void> {
    const create = await runBash(`git checkout -b "${branch}" "${base}"`);
    if (create.isError) {
      await runBash(`git checkout "${branch}"`);
    }
  }

  function haltAndReset(ctx: ExtensionContext, reason: string): void {
    workflow.state = "IDLE";
    pi.setActiveTools(FULL_TOOLS);
    updateStatus(ctx);
    persistState();
    ctx.ui.notify("❌ Coding workflow halted: " + reason, "error");
  }

  // Auto-advance through extension-driven states.
  // Returns when reaching CODING (main session takes over) or COMPLETE_ALL.
  async function advanceCodingWorkflow(ctx: ExtensionContext): Promise<void> {
    while (true) {
      switch (workflow.state) {
        case "FETCHING_ISSUE": {
          pi.setActiveTools(READONLY_TOOLS);
          updateStatus(ctx);
          ctx.ui.notify("📥 Fetching issue details...", "info");

          const match = workflow.issueUrl.match(/github\.com\/([^/]+)\/([^/]+)\/(?:issues|pull)\/(\d+)/);
          if (!match) {
            haltAndReset(ctx, `Invalid issue URL: "${workflow.issueUrl}"`);
            return;
          }

          const [, owner, repo, numberStr] = match;
          workflow.repoOwner = owner;
          workflow.repoName = repo;
          workflow.issueNumber = parseInt(numberStr, 10);

          const issueResult = ghIssueView(workflow.issueNumber, "number,title,body,labels,state,parent");

          if (issueResult.isError) {
            haltAndReset(ctx, "Failed to fetch issue: " + issueResult.content[0].text);
            return;
          }

          const issueData = issueResult.data as any;
          const labels = (issueData.labels || []) as string[];

          if (labels.includes("feature")) workflow.issueType = "feature";
          else if (labels.includes("story")) workflow.issueType = "story";
          else if (labels.includes("task")) workflow.issueType = "task";
          else workflow.issueType = "unknown";

          // Build stories and tasks based on issue type
          if (workflow.issueType === "feature") {
            const storiesResult = ghIssueList({ state: "open", limit: 100, json_fields: "number,title,body,labels,state,parent" });

            const allStories = (storiesResult.data || []) as any[];
            const featureStories = allStories.filter((s: any) => s.parent?.number === workflow.issueNumber);

            const tasksResult = ghIssueList({ state: "open", limit: 100, json_fields: "number,title,body,labels,state,parent" });

            const allTasks = (tasksResult.data || []) as any[];

            workflow.stories = [];
            workflow.tasks = [];

            for (const story of featureStories) {
              const storyVersion = extractVersion(story.title);
              const storyTasks = allTasks
                .filter((t: any) => t.parent?.number === story.number)
                .map((t: any) => ({
                  number: t.number,
                  title: t.title,
                  version: extractVersion(t.title),
                  storyVersion,
                }));

              storyTasks.sort((a: any, b: any) => compareVersions(a.version, b.version));

              workflow.stories.push({
                number: story.number,
                title: story.title,
                version: storyVersion,
                tasks: storyTasks,
              });

              workflow.tasks.push(...storyTasks);
            }

            workflow.tasks.sort((a, b) => compareVersions(a.version, b.version));

          } else if (workflow.issueType === "story") {
            const tasksResult = ghIssueList({ state: "open", limit: 100, json_fields: "number,title,body,labels,state,parent" });

            const allTasks = (tasksResult.data || []) as any[];
            const storyVersion = extractVersion(issueData.title);
            const storyTasks = allTasks
              .filter((t: any) => t.parent?.number === workflow.issueNumber)
              .map((t: any) => ({
                number: t.number,
                title: t.title,
                version: extractVersion(t.title),
                storyVersion,
              }));

            storyTasks.sort((a: any, b: any) => compareVersions(a.version, b.version));

            workflow.stories = [{
              number: workflow.issueNumber,
              title: issueData.title,
              version: storyVersion,
              tasks: storyTasks,
            }];

            workflow.tasks = [...storyTasks];

          } else if (workflow.issueType === "task") {
            workflow.stories = [];
            workflow.tasks = [{
              number: workflow.issueNumber,
              title: issueData.title,
              version: extractVersion(issueData.title),
              storyVersion: "",
            }];
          }

          workflow.totalStories = workflow.stories.length;
          workflow.totalTasks = workflow.tasks.length;
          workflow.currentStoryIndex = 0;
          workflow.currentTaskIndex = 0;

          // Create branches
          const defaultBranchResult = await runBash(
            'git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed \'s@^refs/remotes/origin/@@\''
          );
          const defaultBranch = defaultBranchResult.stdout.trim() || "main";

          const slug = slugify(issueData.title || "feature");
          workflow.featureBranch = `feat/${workflow.issueNumber}-${slug}`;

          await ensureBranch(workflow.featureBranch, defaultBranch);

          for (const story of workflow.stories) {
            const storySlug = slugify(story.title);
            const storyBranch = `story/${workflow.issueNumber}.${story.version}-${storySlug}`;
            await ensureBranch(storyBranch, workflow.featureBranch);
          }

          await runBash(`git checkout "${workflow.featureBranch}"`);

          workflow.state = "PLANNING_FEATURE";
          persistState();
          continue;
        }

        case "PLANNING_FEATURE": {
          pi.setActiveTools(PLANNING_TOOLS);
          updateStatus(ctx);
          ctx.ui.notify("📝 Planning feature architecture...", "info");

          const result = await spawnSubagent(
            ctx.cwd,
            "implementation-planner",
            `Plan implementation for feature #${workflow.issueNumber}: "${workflow.featureBranch}".\n` +
            `Level: feature\n` +
            `Feature branch: ${workflow.featureBranch}\n` +
            `Write .tmp/feat-implementation-${workflow.issueNumber}.md\n\n` +
            `Focus on high-level architecture, cross-story interactions, and a story checklist. ` +
            `Do NOT include task-level details or specific file/line changes.`
          );

          if (result.isError) {
            haltAndReset(ctx, "Feature planning failed: " + result.content?.[0]?.text);
            return;
          }

          workflow.state = "PLANNING_STORIES";
          persistState();
          continue;
        }

        case "PLANNING_STORIES": {
          pi.setActiveTools(PLANNING_TOOLS);
          updateStatus(ctx);

          for (const story of workflow.stories) {
            ctx.ui.notify(`📝 Planning story ${story.version}...`, "info");
            const result = await spawnSubagent(
              ctx.cwd,
              "implementation-planner",
              `Plan implementation for story #${story.number}: "${story.title}".\n` +
              `Level: story\n` +
              `Feature branch: ${workflow.featureBranch}\n` +
              `Write .tmp/story-implementation-${story.version}.md\n\n` +
              `Focus on strategy, cross-task interactions, and a task checklist. ` +
              `Do NOT duplicate feature architecture — reference .tmp/feat-implementation-${workflow.issueNumber}.md. ` +
              `Do NOT include specific file/line changes.`
            );

            if (result.isError) {
              haltAndReset(ctx, `Story ${story.version} planning failed: ` + result.content?.[0]?.text);
              return;
            }
          }

          workflow.state = "PLANNING_TASK";
          workflow.currentTaskIndex = 0;
          persistState();
          continue;
        }

        case "PLANNING_TASK": {
          const task = workflow.tasks[workflow.currentTaskIndex];
          pi.setActiveTools(PLANNING_TOOLS);
          updateStatus(ctx);
          ctx.ui.notify(`📝 Planning task ${task.version}...`, "info");

          const result = await spawnSubagent(
            ctx.cwd,
            "implementation-planner",
            `Plan implementation for task #${task.number}: "${task.title}".\n` +
            `Level: task\n` +
            `Feature branch: ${workflow.featureBranch}\n` +
            `Write .tmp/task-implementation-${task.version}.md\n\n` +
            `Focus on specific file/line changes. Be exact about files, functions, and line numbers. ` +
            `Do NOT duplicate feature/story content — reference:\n` +
            `- .tmp/feat-implementation-${workflow.issueNumber}.md\n` +
            `- .tmp/story-implementation-${task.storyVersion}.md\n\n` +
            `Include linter command, dependencies check, and testing notes.`
          );

          if (result.isError) {
            haltAndReset(ctx, `Task ${task.version} planning failed: ` + result.content?.[0]?.text);
            return;
          }

          workflow.state = "CODING";
          persistState();
          continue;
        }

        case "CODING": {
          const task = workflow.tasks[workflow.currentTaskIndex];
          pi.setActiveTools(CODING_TOOLS);
          updateStatus(ctx);
          ctx.ui.notify(
            `💻 CODING: Task ${task.version} — Load all 3 impl files, write code, run linter, then call complete_coding`,
            "info"
          );
          return; // main session takes over
        }

        case "CREATING_PR": {
          pi.setActiveTools(PR_TOOLS);
          updateStatus(ctx);
          const prType = workflow.prType;
          ctx.ui.notify(`🚀 Creating ${prType} PR...`, "info");

          const result = await spawnSubagent(
            ctx.cwd,
            "pr-writer",
            `Create and merge ${prType} PR.\n` +
            `Repository: ${workflow.repoOwner}/${workflow.repoName}\n` +
            `Type: ${prType}\n` +
            (prType === "task"
              ? `Task branch → Story branch`
              : `Story branch → Feature branch`) +
            `\n\nUse the appropriate PR template from .pi/prompts/pr-templates/. ` +
            `Include "Fixes" links. Merge automatically.`
          );

          if (result.isError) {
            haltAndReset(ctx, `${prType} PR creation failed: ` + result.content?.[0]?.text);
            return;
          }

          workflow.state = "COMPLETE_TASK";
          persistState();
          continue;
        }

        case "COMPLETE_TASK": {
          workflow.currentTaskIndex++;

          if (workflow.currentTaskIndex >= workflow.totalTasks) {
            workflow.state = "COMPLETE_ALL";
            persistState();
            continue;
          }

          const prevTask = workflow.tasks[workflow.currentTaskIndex - 1];
          const nextTask = workflow.tasks[workflow.currentTaskIndex];

          // Crossed a story boundary?
          if (nextTask.storyVersion !== prevTask.storyVersion) {
            workflow.state = "CREATING_PR";
            workflow.prType = "story";
            persistState();
            continue;
          }

          workflow.state = "PLANNING_TASK";
          persistState();
          continue;
        }

        case "COMPLETE_ALL": {
          pi.setActiveTools(FULL_TOOLS);
          const duration = Math.round((Date.now() - workflow.startTime) / 1000);
          updateStatus(ctx);
          ctx.ui.notify(
            `🎉 Coding complete! ${workflow.totalTasks} tasks, ${workflow.totalStories} stories. ` +
            `Duration: ${duration}s. Feature branch: ${workflow.featureBranch}`,
            "info"
          );
          return;
        }

        case "IDLE":
          return;
      }
    }
  }

  // ============ COMMANDS ============

  pi.registerCommand("code", {
    description: "Start the coding workflow for a GitHub issue",
    handler: async (args, ctx) => {
      const issueUrl = args.trim();
      if (!issueUrl) {
        ctx.ui.notify("Usage: /code <github-issue-url>", "error");
        return;
      }

      if (workflow.state !== "IDLE" && workflow.state !== "COMPLETE_ALL") {
        ctx.ui.notify(
          `❌ Coding workflow already in progress (state: ${workflow.state}). Use /reset-code to start fresh.`,
          "error"
        );
        return;
      }

      workflow = {
        state: "FETCHING_ISSUE",
        issueUrl,
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
      await advanceCodingWorkflow(ctx);
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
      pi.setActiveTools(FULL_TOOLS);
      updateStatus(ctx);
      persistState();
      ctx.ui.notify("Coding workflow reset to IDLE state", "info");
    },
  });

  pi.registerCommand("code-status", {
    description: "Show current coding workflow status",
    handler: async (_args, ctx) => {
      const currentTask = workflow.tasks[workflow.currentTaskIndex];
      const currentStory = workflow.stories.find((s) => s.version === currentTask?.storyVersion);
      const status = `
📊 Coding Workflow Status
${"─".repeat(40)}
State: ${workflow.state}
PR Type: ${workflow.prType}
Issue: #${workflow.issueNumber} (${workflow.issueType})
Feature Branch: ${workflow.featureBranch || "(not created)"}
Stories: ${workflow.stories.length}
Tasks: ${workflow.currentTaskIndex}/${workflow.totalTasks}
Current Story: ${currentStory ? `#${currentStory.number} ${currentStory.title}` : "(none)"}
Current Task: ${currentTask ? `#${currentTask.number} ${currentTask.title}` : "(none)"}
      `.trim();
      ctx.ui.notify(status, "info");
    },
  });

  // ============ TOOLS (main-session only) ============

  // Tool: complete_coding — called by CODER after linter passes
  pi.registerTool({
    name: "complete_coding",
    label: "Complete Coding",
    description: "Called by CODER after writing code and running linter successfully.",
    parameters: Type.Object({}),

    async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
      if (workflow.state !== "CODING") {
        return {
          content: [{ type: "text", text: `❌ Cannot complete coding: Workflow is in ${workflow.state} state.` }],
          isError: true,
        };
      }

      workflow.state = "CREATING_PR";
      workflow.prType = "task";
      persistState();

      await advanceCodingWorkflow(ctx);

      if (workflow.state === "COMPLETE_ALL") {
        return {
          content: [{ type: "text", text: `✅ All tasks complete! Feature branch: ${workflow.featureBranch}` }],
        };
      }

      const nextTask = workflow.tasks[workflow.currentTaskIndex];
      return {
        content: [{
          type: "text",
          text:
            `✅ Coding complete for previous task.\n\n` +
            `➡️ Next task ready: ${nextTask.version} — ${nextTask.title}\n\n` +
            `Load implementation files and continue coding.`,
        }],
      };
    },
  });

  // ============ EVENT HANDLERS ============

  pi.on("tool_call", async (event) => {
    // Block write/edit outside .tmp/ during planning phases
    if (["PLANNING_FEATURE", "PLANNING_STORIES", "PLANNING_TASK"].includes(workflow.state)) {
      if (event.toolName === "write" || event.toolName === "edit") {
        const filePath = (event.input.file_path || event.input.path || "") as string;
        if (!filePath.startsWith(".tmp/")) {
          return {
            block: true,
            reason:
              `🚫 Only .tmp/ files may be written during planning phases.\n` +
              `Path: "${filePath}"`,
          };
        }
      }
    }

    // During CODING, block git operations on main/master
    if (workflow.state === "CODING") {
      if (event.toolName === "bash") {
        const cmd = event.input.command as string;
        if (/git\s+(checkout|merge|rebase)\s+(origin\/)?(main|master)\b/.test(cmd)) {
          return {
            block: true,
            reason: `🚫 Cannot operate on main/master branch during coding workflow.`,
          };
        }
      }
    }

    if (event.toolName !== "bash") return undefined;

    const command = event.input.command as string;

    if (isBlockedCommand(command)) {
      return {
        block: true,
        reason: `🚫 Command blocked by coding workflow: "${command}"`,
      };
    }

    if (isPreGrantedCommand(command)) {
      return undefined;
    }

    // During planning phases, restrict bash to read-only
    if (["PLANNING_FEATURE", "PLANNING_STORIES", "PLANNING_TASK"].includes(workflow.state)) {
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
            `⏸️ Only read-only commands allowed during planning phases: "${command}"`,
        };
      }
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
      const task = workflow.tasks[workflow.currentTaskIndex];
      let content = loadPrompt("planning-task-phase");
      content += `\n\nCURRENT TASK: ${task?.version || ""} — ${task?.title || ""}`;
      return {
        message: {
          customType: "coding-context",
          content,
          display: false,
        },
      };
    }

    if (workflow.state === "CODING") {
      const task = workflow.tasks[workflow.currentTaskIndex];
      let content = loadPrompt("coding-phase");
      content +=
        `\n\nCURRENT TASK:\n` +
        `- Version: ${task?.version || ""}\n` +
        `- Title: ${task?.title || ""}\n` +
        `- Number: #${task?.number || ""}\n` +
        `- Story: ${task?.storyVersion || ""}\n\n` +
        `Load these implementation files:\n` +
        `- .tmp/feat-implementation-${workflow.issueNumber}.md\n` +
        `- .tmp/story-implementation-${task?.storyVersion || ""}.md\n` +
        `- .tmp/task-implementation-${task?.version || ""}.md\n\n` +
        `After coding and linting, call complete_coding.`;
      return {
        message: {
          customType: "coding-context",
          content,
          display: false,
        },
      };
    }

    if (workflow.state === "CREATING_PR") {
      return {
        message: {
          customType: "coding-context",
          content:
            `[CODING WORKFLOW: CREATING PR]\n\n` +
            `The PR-WRITER subagent is currently creating and merging the ${workflow.prType} PR. ` +
            `Please wait.`,
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

    // Restore tool restrictions
    switch (workflow.state) {
      case "FETCHING_ISSUE":
      case "PLANNING_FEATURE":
      case "PLANNING_STORIES":
      case "PLANNING_TASK":
        pi.setActiveTools(PLANNING_TOOLS);
        break;
      case "CODING":
        pi.setActiveTools(CODING_TOOLS);
        break;
      case "CREATING_PR":
        pi.setActiveTools(PR_TOOLS);
        break;
      case "COMPLETE_ALL":
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
