// src/hooks/trace/traceRecorder.ts
import * as fs from "fs/promises"
import * as path from "path"
import { v4 as uuidv4 } from "uuid"
import { execSync } from "child_process"
import { SpatialHash } from "./spatialHash"
import { TraceRecord, FileTrace, CodeRange, Contributor, RelatedResource, MutationClass } from "./types/traceSchema"

export interface TraceContext {
	intentId: string
	filePath: string
	content: string
	originalContent?: string
	modelId: string
	sessionId: string
	startLine: number
	endLine: number
	mutationClass?: MutationClass
	confidence?: number
}

export class TraceRecorder {
	private traceDir: string
	private traceFile: string

	constructor(workspaceRoot: string) {
		this.traceDir = path.join(workspaceRoot, ".orchestration")
		this.traceFile = path.join(this.traceDir, "agent_trace.jsonl")
	}

	/**
	 * Initialize trace directory
	 */
	async initialize(): Promise<void> {
		await fs.mkdir(this.traceDir, { recursive: true })
	}

	/**
	 * Record a trace entry
	 */
	async recordTrace(context: TraceContext): Promise<string> {
		const traceId = uuidv4()
		const timestamp = new Date().toISOString()

		// Calculate content hash
		const contentHash = SpatialHash.normalizeAndHash(context.content)

		// Get git info
		const gitInfo = this.getGitInfo()

		// Create contributor
		const contributor: Contributor = {
			entity_type: "AI",
			model_identifier: context.modelId,
			session_id: context.sessionId,
		}

		// Create code range
		const range: CodeRange = {
			start_line: context.startLine,
			end_line: context.endLine,
			content_hash: contentHash,
		}

		// Create related resources
		const related: RelatedResource[] = [
			{
				type: "specification",
				value: context.intentId,
			},
			{
				type: "content_hash",
				value: `sha256:${contentHash}`,
			},
		]

		// If we have mutation classification, add it
		if (context.mutationClass) {
			;(range as any).mutation_class = context.mutationClass
			;(range as any).confidence = context.confidence || 0.8
		}

		// Create file trace
		const fileTrace: FileTrace = {
			relative_path: context.filePath,
			conversations: [
				{
					conversation: {
						url: `session://${context.sessionId}`,
						timestamp: timestamp,
						summary: `AI-generated changes for intent ${context.intentId}`,
					},
					contributor,
					ranges: [range],
					related,
					mutation_class: context.mutationClass,
				},
			],
		}

		// Create complete trace record
		const trace: TraceRecord = {
			id: traceId,
			timestamp,
			vcs: gitInfo,
			files: [fileTrace],
			metadata: {
				session_id: context.sessionId,
				extension_version: "3.48.0",
				tags: ["ai-generated", context.mutationClass || "unknown"],
			},
		}

		// Append to trace file
		await fs.appendFile(this.traceFile, JSON.stringify(trace) + "\n")

		return traceId
	}

	/**
	 * Record multiple traces in batch
	 */
	async recordBatch(contexts: TraceContext[]): Promise<string[]> {
		const traceIds: string[] = []
		let batchContent = ""

		for (const context of contexts) {
			const traceId = uuidv4()
			traceIds.push(traceId)

			const contentHash = SpatialHash.normalizeAndHash(context.content)
			const gitInfo = this.getGitInfo()

			const trace: TraceRecord = {
				id: traceId,
				timestamp: new Date().toISOString(),
				vcs: gitInfo,
				files: [
					{
						relative_path: context.filePath,
						conversations: [
							{
								conversation: {
									url: `session://${context.sessionId}`,
									timestamp: new Date().toISOString(),
								},
								contributor: {
									entity_type: "AI",
									model_identifier: context.modelId,
									session_id: context.sessionId,
								},
								ranges: [
									{
										start_line: context.startLine,
										end_line: context.endLine,
										content_hash: contentHash,
									},
								],
								related: [
									{
										type: "specification",
										value: context.intentId,
									},
								],
								mutation_class: context.mutationClass,
							},
						],
					},
				],
				metadata: {
					session_id: context.sessionId,
				},
			}

			batchContent += JSON.stringify(trace) + "\n"
		}

		await fs.appendFile(this.traceFile, batchContent)
		return traceIds
	}

	/**
	 * Get git information
	 */
	private getGitInfo(): { revision_id: string; branch?: string; is_dirty?: boolean } {
		try {
			const revision_id = execSync("git rev-parse HEAD", { encoding: "utf-8" }).trim()
			const branch = execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf-8" }).trim()
			const status = execSync("git status --porcelain", { encoding: "utf-8" })

			return {
				revision_id,
				branch: branch !== "HEAD" ? branch : undefined,
				is_dirty: status.length > 0,
			}
		} catch {
			return {
				revision_id: "unknown",
				is_dirty: false,
			}
		}
	}

	/**
	 * Query traces by intent ID
	 */
	async queryByIntent(intentId: string): Promise<TraceRecord[]> {
		const traces: TraceRecord[] = []

		try {
			const content = await fs.readFile(this.traceFile, "utf-8")
			const lines = content.split("\n").filter((l) => l.trim())

			for (const line of lines) {
				try {
					const trace = JSON.parse(line) as TraceRecord

					// Check if any file in this trace relates to the intent
					const hasIntent = trace.files.some((file) =>
						file.conversations.some((conv) =>
							conv.related.some((r) => r.type === "specification" && r.value === intentId),
						),
					)

					if (hasIntent) {
						traces.push(trace)
					}
				} catch {
					continue
				}
			}
		} catch {
			// File doesn't exist yet
		}

		return traces
	}

	/**
	 * Query traces by file path
	 */
	async queryByFile(filePath: string): Promise<TraceRecord[]> {
		const traces: TraceRecord[] = []

		try {
			const content = await fs.readFile(this.traceFile, "utf-8")
			const lines = content.split("\n").filter((l) => l.trim())

			for (const line of lines) {
				try {
					const trace = JSON.parse(line) as TraceRecord

					const matchesFile = trace.files.some(
						(f) => f.relative_path === filePath || f.relative_path.endsWith(filePath),
					)

					if (matchesFile) {
						traces.push(trace)
					}
				} catch {
					continue
				}
			}
		} catch {
			// File doesn't exist yet
		}

		return traces
	}

	/**
	 * Find code by content hash (spatial independence)
	 */
	async findByContentHash(contentHash: string): Promise<Array<{ trace: TraceRecord; file: string }>> {
		const results: Array<{ trace: TraceRecord; file: string }> = []

		try {
			const content = await fs.readFile(this.traceFile, "utf-8")
			const lines = content.split("\n").filter((l) => l.trim())

			for (const line of lines) {
				try {
					const trace = JSON.parse(line) as TraceRecord

					for (const file of trace.files) {
						for (const conv of file.conversations) {
							for (const range of conv.ranges) {
								if (range.content_hash === contentHash) {
									results.push({ trace, file: file.relative_path })
								}
							}
						}
					}
				} catch {
					continue
				}
			}
		} catch {
			// File doesn't exist yet
		}

		return results
	}
}
