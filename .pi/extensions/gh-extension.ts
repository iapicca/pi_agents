/**
 * GitHub CLI Extension
 *
 * Provides structured Pi tools that wrap the `gh` command-line interface.
 * Replaces raw bash usage with typed parameters, JSON parsing, and graceful error handling.
 *
 * Pre-granted: all tools in this extension execute without user confirmation.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import {
  ghIssueCreate,
  ghIssueList,
  ghIssueView,
  ghPrCreate,
  ghPrMerge,
  ghPrView,
  ghRepoView,
  ghApi,
  ghRemoteUrl,
} from "./workflow-helpers.js";

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
      const result = ghIssueCreate({
        title: params.title,
        body: params.body,
        label: params.label,
        parent: params.parent,
        milestone: params.milestone,
      });
      if (result.isError) {
        return { content: result.content, isError: true };
      }
      return {
        content: result.content,
        data: { issueNumber: result.issueNumber, url: result.url },
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
      const result = ghIssueList({
        label: params.label,
        state: params.state,
        limit: params.limit,
        json_fields: params.json_fields,
        search: params.search,
      });
      if (result.isError) {
        return { content: result.content, isError: true };
      }
      return {
        content: [{ type: "text", text: `Found ${result.data.length} issue(s).` }],
        data: result.data,
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
      const result = ghIssueView(params.number, params.json_fields);
      if (result.isError) {
        return { content: result.content, isError: true };
      }
      return {
        content: [{ type: "text", text: `Issue #${params.number} loaded.` }],
        data: result.data,
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
      const result = ghPrCreate({
        title: params.title,
        body: params.body,
        base: params.base,
        head: params.head,
        draft: params.draft,
      });
      if (result.isError) {
        return { content: result.content, isError: true };
      }
      return {
        content: result.content,
        data: { prNumber: result.prNumber, url: result.url },
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
      const result = ghPrMerge({
        number_or_branch: params.number_or_branch,
        method: params.method,
        delete_branch: params.delete_branch,
      });
      if (result.isError) {
        return { content: result.content, isError: true };
      }
      return { content: result.content };
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
      const result = ghPrView(params.number_or_branch, params.json_fields);
      if (result.isError) {
        return { content: result.content, isError: true };
      }
      return {
        content: [{ type: "text", text: `PR loaded.` }],
        data: result.data,
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
      const result = ghRepoView(params.json_fields);
      if (result.isError) {
        return { content: result.content, isError: true };
      }
      return {
        content: [{ type: "text", text: `Repository info loaded.` }],
        data: result.data,
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
      const result = ghApi(params.endpoint, {
        method: params.method,
        input: params.input,
        preview: params.preview,
      });
      if (result.isError) {
        return { content: result.content, isError: true };
      }
      return {
        content: [{ type: "text", text: `API call succeeded.` }],
        data: result.data,
      };
    },
  });

  pi.registerTool({
    name: "gh_remote_url",
    label: "Get Remote URL",
    description: "Get the GitHub remote URL of the current repository.",
    parameters: Type.Object({}),

    async execute() {
      const result = ghRemoteUrl();
      if (result.isError) {
        return { content: result.content, isError: true };
      }
      return {
        content: [{ type: "text", text: result.url ?? "" }],
        data: { url: result.url },
      };
    },
  });
}
