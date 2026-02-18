// File: src/hooks/postHooks.ts
import { HookContext, PostHook, ToolResult } from "./index"
import * as fs from "fs/promises"
import * as path from "path"
import { createHash } from "crypto"

export function hashContent(content: string): string {
	return createHash("sha256").update(content).digest("hex")
}

export const traceRecorder: PostHook = async (context: HookContext, result: ToolResult) => {
	if (context.toolName !== "write_to_file" || !result.success) {
		return
	}

	const trace = {
		id: crypto.randomUUID(),
		timestamp: new Date().toISOString(),
		vcs: { revision_id: "pending" },
		files: [
			{
				relative_path: context.args.path,
				conversations: [
					{
						contributor: {
							entity_type: "AI",
							model_identifier: "claude-3-5-sonnet",
						},
						ranges: [
							{
								start_line: 1,
								end_line: 1,
								content_hash: hashContent(context.args.content),
							},
						],
						related: [
							{
								type: "specification",
								value: context.session.intentId,
							},
						],
					},
				],
			},
		],
	}

	// Ensure .orchestration directory exists
	const traceDir = path.join(process.cwd(), ".orchestration")
	await fs.mkdir(traceDir, { recursive: true })

	// Append to trace file
	const tracePath = path.join(traceDir, "agent_trace.jsonl")
	await fs.appendFile(tracePath, JSON.stringify(trace) + "\n")
}
