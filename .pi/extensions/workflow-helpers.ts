import { execSync } from "node:child_process";
import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { withFileMutationQueue } from "@mariozechner/pi-coding-agent";
import { type AgentConfig, discoverAgents } from "./subagent/agents.js";

export type { AgentConfig };
export { discoverAgents };

export async function runBash(command: string): Promise<{ stdout: string; isError: boolean }> {
	try {
		const stdout = execSync(command, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
		return { stdout: stdout.trim(), isError: false };
	} catch (err: any) {
		return {
			stdout: err.stdout?.toString?.() ?? err.stderr?.toString?.() ?? "",
			isError: true,
		};
	}
}

export function runGh(args: string[], input?: string): { stdout: string; stderr: string; isError: boolean } {
	try {
		const stdout = execSync(`gh ${args.join(" ")}`, {
			input,
			encoding: "utf-8",
			stdio: ["pipe", "pipe", "pipe"],
			maxBuffer: 10 * 1024 * 1024,
		});
		return { stdout: stdout.trim(), stderr: "", isError: false };
	} catch (err: any) {
		return {
			stdout: err.stdout?.toString?.() ?? "",
			stderr: err.stderr?.toString?.() ?? err.message ?? "Unknown error",
			isError: true,
		};
	}
}

export function runGhJson(
	args: string[],
	input?: string,
): { isError: boolean; data: any; content: [{ type: "text"; text: string }] } {
	const result = runGh(args, input);
	if (result.isError) {
		return {
			isError: true,
			data: null,
			content: [{ type: "text", text: `gh command failed:\n${result.stderr || result.stdout}` }],
		};
	}
	try {
		const data = JSON.parse(result.stdout);
		return {
			isError: false,
			data,
			content: [{ type: "text", text: "GitHub CLI command succeeded." }],
		};
	} catch {
		return {
			isError: false,
			data: result.stdout,
			content: [{ type: "text", text: result.stdout }],
		};
	}
}

// ── GitHub CLI wrappers ──────────────────────────────────────────────────────

export function ghIssueView(
	number: number,
	jsonFields = "number,title,body,labels,state,parent",
): { isError: boolean; data: any; content: [{ type: "text"; text: string }] } {
	return runGhJson(["issue", "view", String(number), "--json", jsonFields]);
}

export function ghIssueList(
	options: {
		label?: string;
		state?: string;
		limit?: number;
		json_fields?: string;
		search?: string;
	} = {},
): { isError: boolean; data: any[]; content: [{ type: "text"; text: string }] } {
	const args = ["issue", "list", "--state", options.state ?? "open", "--limit", String(options.limit ?? 30)];
	if (options.label) args.push("--label", options.label);
	if (options.search) args.push("--search", options.search);
	args.push("--json", options.json_fields ?? "number,title,labels,state");
	const result = runGhJson(args);
	return { ...result, data: (result.data ?? []) as any[] };
}

export function ghIssueCreate(options: {
	title: string;
	body: string;
	label?: string;
	parent?: number;
	milestone?: string;
}): { isError: boolean; issueNumber?: number; url?: string; content: [{ type: "text"; text: string }] } {
	const args = ["issue", "create", "--title", options.title, "--body", options.body];
	if (options.label) args.push("--label", options.label);
	if (options.parent) args.push("--parent", String(options.parent));
	if (options.milestone) args.push("--milestone", options.milestone);

	const result = runGh(args);
	if (result.isError) {
		return {
			isError: true,
			content: [{ type: "text", text: `❌ gh issue create failed:\n${result.stderr || result.stdout}` }],
		};
	}

	const match = result.stdout.match(/\/issues\/(\d+)/);
	const issueNumber = match ? parseInt(match[1], 10) : null;

	return {
		isError: false,
		issueNumber: issueNumber ?? undefined,
		url: result.stdout.trim(),
		content: [
			{
				type: "text",
				text: `✅ Issue created${issueNumber ? ` (#${issueNumber})` : ""}\n${result.stdout}`,
			},
		],
	};
}

export function ghPrCreate(options: {
	title: string;
	body: string;
	base: string;
	head: string;
	draft?: boolean;
}): { isError: boolean; prNumber?: number; url?: string; content: [{ type: "text"; text: string }] } {
	const args = ["pr", "create", "--title", options.title, "--body", options.body, "--base", options.base, "--head", options.head];
	if (options.draft) args.push("--draft");

	const result = runGh(args);
	if (result.isError) {
		return {
			isError: true,
			content: [{ type: "text", text: `❌ gh pr create failed:\n${result.stderr || result.stdout}` }],
		};
	}

	const match = result.stdout.match(/\/pull\/(\d+)/);
	const prNumber = match ? parseInt(match[1], 10) : null;

	return {
		isError: false,
		prNumber: prNumber ?? undefined,
		url: result.stdout.trim(),
		content: [
			{
				type: "text",
				text: `✅ PR created${prNumber ? ` (#${prNumber})` : ""}\n${result.stdout}`,
			},
		],
	};
}

export function ghPrMerge(options: {
	number_or_branch: string | number;
	method?: string;
	delete_branch?: boolean;
}): { isError: boolean; content: [{ type: "text"; text: string }] } {
	const args = ["pr", "merge", String(options.number_or_branch), `--${options.method ?? "squash"}`];
	if (options.delete_branch !== false) args.push("--delete-branch");

	const result = runGh(args);
	if (result.isError) {
		return {
			isError: true,
			content: [{ type: "text", text: `❌ gh pr merge failed:\n${result.stderr || result.stdout}` }],
		};
	}

	return {
		isError: false,
		content: [{ type: "text", text: `✅ PR merged.\n${result.stdout}` }],
	};
}

export function ghPrView(
	numberOrBranch: string | number,
	jsonFields = "number,title,state,url,headRefName,baseRefName",
): { isError: boolean; data: any; content: [{ type: "text"; text: string }] } {
	return runGhJson(["pr", "view", String(numberOrBranch), "--json", jsonFields]);
}

export function ghRepoView(
	jsonFields = "nameWithOwner,defaultBranchRef,url",
): { isError: boolean; data: any; content: [{ type: "text"; text: string }] } {
	return runGhJson(["repo", "view", "--json", jsonFields]);
}

export function ghApi(
	endpoint: string,
	options: { method?: string; input?: string; preview?: string } = {},
): { isError: boolean; data: any; content: [{ type: "text"; text: string }] } {
	const args = ["api", endpoint, "--method", options.method ?? "GET"];
	if (options.input) args.push("--input", "-");
	if (options.preview) args.push("--preview", options.preview);
	return runGhJson(args, options.input);
}

export function ghRemoteUrl(): {
	isError: boolean;
	url?: string;
	content: [{ type: "text"; text: string }];
} {
	const result = runGhJson(["repo", "view", "--json", "url"]);
	if (!result.isError) {
		const data = result.data as { url?: string } | undefined;
		return {
			isError: false,
			url: data?.url ?? (typeof result.data === "string" ? result.data : undefined),
			content: [{ type: "text", text: data?.url ?? String(result.data) }],
		};
	}

	const gitResult = runGh(["remote", "get-url", "origin"]);
	if (gitResult.isError) {
		return {
			isError: true,
			content: [
				{
					type: "text",
					text: `❌ Could not get remote URL:\n${result.content[0].text}\n${gitResult.stderr || gitResult.stdout}`,
				},
			],
		};
	}

	return {
		isError: false,
		url: gitResult.stdout.trim(),
		content: [{ type: "text", text: gitResult.stdout }],
	};
}

// ── Subagent spawning ────────────────────────────────────────────────────────

export async function spawnSubagent(
	cwd: string,
	agentName: string,
	task: string,
	agentScope: "user" | "project" | "both" = "both",
): Promise<{ isError: boolean; content: [{ type: "text"; text: string }]; data?: any }> {
	const discovery = discoverAgents(cwd, agentScope);
	const agent = discovery.agents.find((a) => a.name === agentName);

	if (!agent) {
		const available = discovery.agents.map((a) => `"${a.name}"`).join(", ") || "none";
		return {
			isError: true,
			content: [{ type: "text", text: `Unknown agent: "${agentName}". Available: ${available}` }],
		};
	}

	const args: string[] = ["--mode", "json", "-p", "--no-session"];
	if (agent.model) args.push("--model", agent.model);
	if (agent.tools && agent.tools.length > 0) args.push("--tools", agent.tools.join(","));

	let tmpPromptPath: string | null = null;

	try {
		if (agent.systemPrompt.trim()) {
			const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "pi-subagent-"));
			const safeName = agent.name.replace(/[^\w.-]+/g, "_");
			tmpPromptPath = path.join(tmpDir, `prompt-${safeName}.md`);
			await withFileMutationQueue(tmpPromptPath, async () => {
				await fs.promises.writeFile(tmpPromptPath!, agent.systemPrompt, { encoding: "utf-8", mode: 0o600 });
			});
			args.push("--append-system-prompt", tmpPromptPath);
		}

		args.push(`Task: ${task}`);

		const currentScript = process.argv[1];
		const isBunVirtualScript = currentScript?.startsWith("/$bunfs/root/");
		let command: string;
		let commandArgs: string[];

		if (currentScript && !isBunVirtualScript && fs.existsSync(currentScript)) {
			command = process.execPath;
			commandArgs = [currentScript, ...args];
		} else {
			const execName = path.basename(process.execPath).toLowerCase();
			const isGenericRuntime = /^(node|bun)(\.exe)?$/.test(execName);
			if (!isGenericRuntime) {
				command = process.execPath;
				commandArgs = args;
			} else {
				command = "pi";
				commandArgs = args;
			}
		}

		const { stdout, stderr, exitCode } = await new Promise<{ stdout: string; stderr: string; exitCode: number }>(
			(resolve) => {
				const proc = spawn(command, commandArgs, {
					cwd,
					shell: false,
					stdio: ["ignore", "pipe", "pipe"],
				});
				let buffer = "";
				let stdout = "";
				let stderr = "";

				const processLine = (line: string) => {
					if (!line.trim()) return;
					try {
						const event = JSON.parse(line);
						if (event.type === "message_end" && event.message?.role === "assistant") {
							for (const part of event.message.content) {
								if (part.type === "text") stdout = part.text;
							}
						}
					} catch {
						// ignore non-JSON lines
					}
				};

				proc.stdout.on("data", (data) => {
					buffer += data.toString();
					const lines = buffer.split("\n");
					buffer = lines.pop() || "";
					for (const line of lines) processLine(line);
				});

				proc.stderr.on("data", (data) => {
					stderr += data.toString();
				});

				proc.on("close", (code) => {
					if (buffer.trim()) processLine(buffer);
					resolve({ stdout, stderr, exitCode: code ?? 0 });
				});

				proc.on("error", () => {
					resolve({ stdout, stderr, exitCode: 1 });
				});
			},
		);

		if (exitCode !== 0) {
			return {
				isError: true,
				content: [
					{ type: "text", text: `Subagent failed (exit ${exitCode}):\n${stderr || stdout || "(no output)"}` },
				],
			};
		}

		return {
			isError: false,
			content: [{ type: "text", text: stdout || "(no output)" }],
		};
	} finally {
		if (tmpPromptPath) {
			try {
				const dir = path.dirname(tmpPromptPath);
				fs.unlinkSync(tmpPromptPath);
				fs.rmdirSync(dir);
			} catch {
				// ignore
			}
		}
	}
}
