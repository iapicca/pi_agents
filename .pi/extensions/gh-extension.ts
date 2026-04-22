/**
 * GitHub CLI Extension
 *
 * Provides structured Pi tools that wrap the `gh` command-line interface.
 * Replaces raw bash usage with typed parameters, JSON parsing, and graceful error handling.
 *
 * Pre-granted: all tools in this extension execute without user confirmation.
 */

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { execSync } from "node:child_process";

function gh(args: string[], input?: string): { stdout: string; stderr: string; code: number } {
  try {
    const stdout = execSync(`gh ${args.join(" ")}`, {
      input,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      maxBuffer: 10 * 1024 * 1024,
    });
    return { stdout: stdout.trim(), stderr: "", code: 0 };
  } catch (err: any) {
    return {
      stdout: err.stdout?.toString?.() ?? "",
      stderr: err.stderr?.toString?.() ?? err.message ?? "Unknown error",
      code: err.status ?? 1,
    };
  }
}

function parseJson<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export default function ghExtension(pi: ExtensionAPI): void {
  // ── Issue Tools ──

  pi.registerTool({
    name: "gh_issue_create",
    label: "Create GitHub Issue",
    description: "Create a GitHub issue with structured fields. Returns the created issue JSON.",
    parameters: Type.Object({
      title: Type.String({ description: "Issue title (should include semantic version prefix)" }),
      body: Type.String({ description: "Issue body markdown" }),
      label: Type.Optional(Type.String({ description: "Comma-separated labels" })),
      parent: Type.Optional(Type.Number({ description: "Parent issue number for sub-issues" })),
      milestone: Type.Optional(Type.String({ description: "Milestone title" })),
    }),

    async execute(_toolCallId, params) {
      const args = ["issue", "create", "--title", params.title, "--body", params.body];
      if (params.label) args.push("--label", params.label);
      if (params.parent) args.push("--parent", String(params.parent));
      if (params.milestone) args.push("--milestone", params.milestone);

      const result = gh(args);
      if (result.code !== 0) {
        return {
          content: [{ type: "text", text: `❌ gh issue create failed:\n${result.stderr}` }],
          isError: true,
        };
      }

      // Output usually contains the issue URL; try to extract the number
      const match = result.stdout.match(/\/issues\/(\d+)/);
      const issueNumber = match ? parseInt(match[1], 10) : null;

      return {
        content: [
          {
            type: "text",
            text: `✅ Issue created${issueNumber ? ` (#${issueNumber})` : ""}\n${result.stdout}`,
          },
        ],
        data: { issueNumber, url: result.stdout.trim() },
      };
    },
  });

  pi.registerTool({
    name: "gh_issue_list",
    label: "List GitHub Issues",
    description: "List GitHub issues with optional filters. Returns JSON array of issues.",
    parameters: Type.Object({
      label: Type.Optional(Type.String({ description: "Filter by label" })),
      state: Type.Optional(Type.String({ default: "open", description: "Issue state: open, closed, all" })),
      limit: Type.Optional(Type.Number({ default: 30, description: "Maximum number of issues" })),
      json_fields: Type.Optional(Type.String({ default: "number,title,labels,state", description: "Comma-separated fields for JSON output" })),
      search: Type.Optional(Type.String({ description: "Search query string" })),
    }),

    async execute(_toolCallId, params) {
      const args = ["issue", "list", "--state", params.state ?? "open", "--limit", String(params.limit ?? 30)];
      if (params.label) args.push("--label", params.label);
      if (params.search) args.push("--search", params.search);
      args.push("--json", params.json_fields ?? "number,title,labels,state");

      const result = gh(args);
      if (result.code !== 0) {
        return {
          content: [{ type: "text", text: `❌ gh issue list failed:\n${result.stderr}` }],
          isError: true,
        };
      }

      const data = parseJson<unknown[]>(result.stdout) ?? [];
      return {
        content: [{ type: "text", text: `Found ${data.length} issue(s).` }],
        data,
      };
    },
  });

  pi.registerTool({
    name: "gh_issue_view",
    label: "View GitHub Issue",
    description: "View a single GitHub issue by number. Returns JSON issue data.",
    parameters: Type.Object({
      number: Type.Number({ description: "Issue number" }),
      json_fields: Type.Optional(Type.String({ default: "number,title,body,labels,state,parent", description: "Comma-separated fields for JSON output" })),
    }),

    async execute(_toolCallId, params) {
      const args = ["issue", "view", String(params.number), "--json", params.json_fields ?? "number,title,body,labels,state,parent"];
      const result = gh(args);
      if (result.code !== 0) {
        return {
          content: [{ type: "text", text: `❌ gh issue view failed:\n${result.stderr}` }],
          isError: true,
        };
      }

      const data = parseJson<Record<string, unknown>>(result.stdout);
      return {
        content: [{ type: "text", text: `Issue #${params.number} loaded.` }],
        data,
      };
    },
  });

  // ── PR Tools ──

  pi.registerTool({
    name: "gh_pr_create",
    label: "Create Pull Request",
    description: "Create a PR from head to base branch. Returns the PR URL.",
    parameters: Type.Object({
      title: Type.String({ description: "PR title" }),
      body: Type.String({ description: "PR body markdown" }),
      base: Type.String({ description: "Target branch" }),
      head: Type.String({ description: "Source branch" }),
      draft: Type.Optional(Type.Boolean({ default: false, description: "Create as draft" })),
    }),

    async execute(_toolCallId, params) {
      const args = ["pr", "create", "--title", params.title, "--body", params.body, "--base", params.base, "--head", params.head];
      if (params.draft) args.push("--draft");

      const result = gh(args);
      if (result.code !== 0) {
        return {
          content: [{ type: "text", text: `❌ gh pr create failed:\n${result.stderr}` }],
          isError: true,
        };
      }

      const match = result.stdout.match(/\/pull\/(\d+)/);
      const prNumber = match ? parseInt(match[1], 10) : null;

      return {
        content: [
          {
            type: "text",
            text: `✅ PR created${prNumber ? ` (#${prNumber})` : ""}\n${result.stdout}`,
          },
        ],
        data: { prNumber, url: result.stdout.trim() },
      };
    },
  });

  pi.registerTool({
    name: "gh_pr_merge",
    label: "Merge Pull Request",
    description: "Merge a PR by number or branch. Supports squash, merge, or rebase.",
    parameters: Type.Object({
      number_or_branch: Type.Union([Type.Number(), Type.String()], { description: "PR number or branch name" }),
      method: Type.Optional(Type.String({ default: "squash", description: "squash, merge, or rebase" })),
      delete_branch: Type.Optional(Type.Boolean({ default: true, description: "Delete branch after merge" })),
    }),

    async execute(_toolCallId, params) {
      const args = ["pr", "merge", String(params.number_or_branch), `--${params.method ?? "squash"}`];
      if (params.delete_branch !== false) args.push("--delete-branch");

      const result = gh(args);
      if (result.code !== 0) {
        return {
          content: [{ type: "text", text: `❌ gh pr merge failed:\n${result.stderr}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: "text", text: `✅ PR merged.\n${result.stdout}` }],
      };
    },
  });

  pi.registerTool({
    name: "gh_pr_view",
    label: "View Pull Request",
    description: "View a PR by number or branch. Returns JSON PR data.",
    parameters: Type.Object({
      number_or_branch: Type.Union([Type.Number(), Type.String()], { description: "PR number or branch name" }),
      json_fields: Type.Optional(Type.String({ default: "number,title,state,url,headRefName,baseRefName", description: "Comma-separated fields for JSON output" })),
    }),

    async execute(_toolCallId, params) {
      const args = ["pr", "view", String(params.number_or_branch), "--json", params.json_fields ?? "number,title,state,url,headRefName,baseRefName"];
      const result = gh(args);
      if (result.code !== 0) {
        return {
          content: [{ type: "text", text: `❌ gh pr view failed:\n${result.stderr}` }],
          isError: true,
        };
      }

      const data = parseJson<Record<string, unknown>>(result.stdout);
      return {
        content: [{ type: "text", text: `PR loaded.` }],
        data,
      };
    },
  });

  // ── Repo / Generic Tools ──

  pi.registerTool({
    name: "gh_repo_view",
    label: "View Repository",
    description: "View repository metadata. Returns JSON.",
    parameters: Type.Object({
      json_fields: Type.Optional(Type.String({ default: "nameWithOwner,defaultBranchRef,url", description: "Comma-separated fields for JSON output" })),
    }),

    async execute(_toolCallId, params) {
      const args = ["repo", "view", "--json", params.json_fields ?? "nameWithOwner,defaultBranchRef,url"];
      const result = gh(args);
      if (result.code !== 0) {
        return {
          content: [{ type: "text", text: `❌ gh repo view failed:\n${result.stderr}` }],
          isError: true,
        };
      }

      const data = parseJson<Record<string, unknown>>(result.stdout);
      return {
        content: [{ type: "text", text: `Repository info loaded.` }],
        data,
      };
    },
  });

  pi.registerTool({
    name: "gh_api",
    label: "GitHub API",
    description: "Make an authenticated GitHub API call via gh. Returns JSON response.",
    parameters: Type.Object({
      endpoint: Type.String({ description: "API endpoint path (e.g., repos/owner/repo/issues)" }),
      method: Type.Optional(Type.String({ default: "GET", description: "HTTP method" })),
      input: Type.Optional(Type.String({ description: "JSON payload for POST/PATCH/PUT" })),
      preview: Type.Optional(Type.String({ description: "Accept preview header" })),
    }),

    async execute(_toolCallId, params) {
      const args = ["api", params.endpoint, "--method", params.method ?? "GET"];
      if (params.input) args.push("--input", "-");
      if (params.preview) args.push("--preview", params.preview);

      const result = gh(args, params.input);
      if (result.code !== 0) {
        return {
          content: [{ type: "text", text: `❌ gh api failed:\n${result.stderr}` }],
          isError: true,
        };
      }

      const data = parseJson<unknown>(result.stdout) ?? result.stdout;
      return {
        content: [{ type: "text", text: `API call succeeded.` }],
        data,
      };
    },
  });

  pi.registerTool({
    name: "gh_remote_url",
    label: "Get Remote URL",
    description: "Get the GitHub remote URL of the current repository.",
    parameters: Type.Object({}),

    async execute() {
      const result = gh(["repo", "view", "--json", "url"]);
      if (result.code !== 0) {
        // Fallback to git remote
        const gitResult = gh(["remote", "get-url", "origin"]);
        if (gitResult.code !== 0) {
          return {
            content: [{ type: "text", text: `❌ Could not get remote URL:\n${result.stderr}\n${gitResult.stderr}` }],
            isError: true,
          };
        }
        return {
          content: [{ type: "text", text: gitResult.stdout }],
          data: { url: gitResult.stdout.trim() },
        };
      }

      const data = parseJson<Record<string, unknown>>(result.stdout);
      return {
        content: [{ type: "text", text: String(data?.url ?? result.stdout) }],
        data,
      };
    },
  });
}
