// src/hooks/postHooks.ts
import { HookContext, PostHook, ToolResult } from "./index"
import * as fs from "fs/promises"
import * as path from "path"
import { createHash } from "crypto"
import { AutonomousRecovery } from "./recovery/errorHandler"
// Add to src/hooks/postHooks.ts imports
import { TraceRecorder } from "./trace/traceRecorder"
import { SpatialHash } from "./trace/spatialHash"
import { getIntentById } from "./utils/intentLoader"

export function hashContent(content: string): string {
	return createHash("sha256")
		.update(content || "")
		.digest("hex")
}

export const traceRecorder: PostHook = async (context: HookContext, result: ToolResult) => {
	if (context.toolName !== "write_to_file" || !result?.success) {
		return
	}

	try {
		const trace = {
			id: crypto.randomUUID ? crypto.randomUUID() : `trace-${Date.now()}`,
			timestamp: new Date().toISOString(),
			vcs: { revision_id: "pending" },
			files: [
				{
					relative_path: context.args.path || "unknown",
					conversations: [
						{
							contributor: {
								entity_type: "AI" as const,
								model_identifier: "claude-3-5-sonnet",
							},
							ranges: [
								{
									start_line: 1,
									end_line: 1,
									content_hash: hashContent(context.args.content || ""),
								},
							],
							related: [
								{
									type: "specification" as const,
									value: context.session.intentId || "unknown",
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
	} catch (error) {
		console.error("Trace recording failed:", error)
	}
}

export const lessonRecorder: PostHook = async (context: HookContext, result: ToolResult) => {
	if (result?.success !== false) {
		return
	}

	try {
		const lesson = `
## Lesson Learned (${new Date().toISOString()})
- **Context**: Intent ${context.session.intentId || "none"}
- **Failure**: ${result?.error?.message || "Unknown error"}
- **Tool**: ${context.toolName}
`

		const claudePath = path.join(process.cwd(), ".orchestration", "CLAUDE.md")
		await fs.mkdir(path.dirname(claudePath), { recursive: true })
		await fs.appendFile(claudePath, lesson)
	} catch (error) {
		console.error("Lesson recording failed:", error)
	}
}

// Fixed recovery logger - using public method
export const recoveryLogger: PostHook = async (context: HookContext, result: ToolResult) => {
	if (result?.success !== false) {
		return
	}

	try {
		const errorType = result?.error?.type || "Unknown"
		const suggestions = AutonomousRecovery.getSuggestedActions(errorType)

		const lesson = `
## Recovery Learning (${new Date().toISOString()})
- **Error Type**: ${errorType}
- **Tool**: ${context.toolName}
- **Intent**: ${context.session.intentId || "none"}
- **Recovery Strategy**: ${suggestions[0] || "No suggestion available"}
- **User Feedback**: ${context.userFeedback || "none"}

This error was handled by the autonomous recovery system.
`

		const claudePath = path.join(process.cwd(), ".orchestration", "CLAUDE.md")
		await fs.mkdir(path.dirname(claudePath), { recursive: true })
		await fs.appendFile(claudePath, lesson)
	} catch (error) {
		console.error("Recovery logging failed:", error)
	}
}

// Initialize trace recorder (add near top of file)
let traceRecorderInstance: TraceRecorder | null = null

export function initializeTraceRecorder(workspaceRoot: string) {
	traceRecorderInstance = new TraceRecorder(workspaceRoot)
	traceRecorderInstance.initialize().catch(console.error)
}

// Enhanced trace recorder with classification
export const enhancedTraceRecorder: PostHook = async (context: HookContext, result: ToolResult) => {
	if (context.toolName !== "write_to_file" || !result?.success || !traceRecorderInstance) {
		return
	}

	try {
		const filePath = context.args.path
		const content = context.args.content || ""
		const intentId = context.session.intentId

		if (!intentId) {
			console.warn("No intent ID for trace recording")
			return
		}

		// Get original content if exists for classification
		let originalContent: string | undefined
		try {
			const fs = await import("fs/promises")
			originalContent = await fs.readFile(filePath, "utf-8")
		} catch {
			// File doesn't exist yet (new file)
		}

		// Classify the mutation
		let mutationClass = "AST_REFACTOR"
		let confidence = 0.8

		if (originalContent) {
			const classification = await SpatialHash.classifyMutation(originalContent, content)
			mutationClass = classification.class
			confidence = classification.confidence
		}

		// Determine line numbers (simplified - in real implementation, you'd get actual ranges)
		const lines = content.split("\n").length

		// Record trace
		const traceId = await traceRecorderInstance.recordTrace({
			intentId,
			filePath,
			content,
			originalContent,
			modelId: (context.session as any).modelId || "unknown",
			sessionId: context.session.conversationId,
			startLine: 1,
			endLine: lines,
			mutationClass: mutationClass as any,
			confidence,
		})

		// Log for debugging
		console.log(`✅ Trace recorded: ${traceId} - ${mutationClass} for ${filePath}`)

		// Also update intent_map.md
		await updateIntentMap(intentId, filePath, mutationClass)
	} catch (error) {
		console.error("Trace recording failed:", error)
	}
}

// Helper to update intent map
async function updateIntentMap(intentId: string, filePath: string, mutationClass: string): Promise<void> {
	try {
		const fs = await import("fs/promises")
		const path = await import("path")

		const mapPath = path.join(process.cwd(), ".orchestration", "intent_map.md")
		const intent = await getIntentById(intentId)

		if (!intent) return

		const entry = `\n## ${intentId}: ${intent.name}\n`
		const fileEntry = `- ${filePath} (${mutationClass} - ${new Date().toLocaleString()})\n`

		let content = ""
		try {
			content = await fs.readFile(mapPath, "utf-8")
		} catch {
			content = "# Intent to File Mapping\n\n"
		}

		// Check if intent already has section
		if (content.includes(`## ${intentId}:`)) {
			// Append to existing section
			const lines = content.split("\n")
			const insertIndex = lines.findIndex((l) => l.startsWith(`## ${intentId}:`)) + 1
			lines.splice(insertIndex, 0, fileEntry)
			content = lines.join("\n")
		} else {
			// Add new section
			content += entry + fileEntry
		}

		await fs.writeFile(mapPath, content)
	} catch (error) {
		console.error("Intent map update failed:", error)
	}
}
