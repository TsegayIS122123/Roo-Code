// src/hooks/trace/traceQuery.ts
import { TraceRecorder } from "./traceRecorder"
import { TraceRecord } from "./types/traceSchema"
import * as path from "path"
import { SpatialHash } from "./spatialHash"

export class TraceQuery {
	private recorder: TraceRecorder

	constructor(workspaceRoot: string) {
		this.recorder = new TraceRecorder(workspaceRoot)
	}

	/**
	 * Get full history of an intent
	 */
	async getIntentHistory(intentId: string): Promise<{
		traces: TraceRecord[]
		files: Set<string>
		firstSeen: Date | null
		lastSeen: Date | null
		changeCount: number
	}> {
		const traces = await this.recorder.queryByIntent(intentId)

		const files = new Set<string>()
		let firstSeen: Date | null = null
		let lastSeen: Date | null = null

		traces.forEach((trace) => {
			trace.files.forEach((file) => files.add(file.relative_path))

			const traceDate = new Date(trace.timestamp)
			if (!firstSeen || traceDate < firstSeen) firstSeen = traceDate
			if (!lastSeen || traceDate > lastSeen) lastSeen = traceDate
		})

		return {
			traces,
			files,
			firstSeen,
			lastSeen,
			changeCount: traces.length,
		}
	}

	/**
	 * Generate impact report for an intent
	 */
	async generateImpactReport(intentId: string): Promise<string> {
		const history = await this.getIntentHistory(intentId)

		if (history.traces.length === 0) {
			return `No trace data found for intent ${intentId}`
		}

		let report = `# Impact Report: ${intentId}\n\n`
		report += `**First Change:** ${history.firstSeen?.toLocaleString()}\n`
		report += `**Last Change:** ${history.lastSeen?.toLocaleString()}\n`
		report += `**Total Changes:** ${history.changeCount}\n`
		report += `**Files Affected:** ${history.files.size}\n\n`

		report += `## Files Modified\n`
		history.files.forEach((file) => {
			report += `- ${file}\n`
		})

		report += `\n## Change Timeline\n`
		history.traces.slice(0, 10).forEach((trace, i) => {
			report += `\n### ${new Date(trace.timestamp).toLocaleString()}\n`
			trace.files.forEach((file) => {
				file.conversations.forEach((conv) => {
					const mutationClass = conv.mutation_class || "unknown"
					report += `- ${file.relative_path} (${mutationClass})\n`
				})
			})
		})

		if (history.traces.length > 10) {
			report += `\n... and ${history.traces.length - 10} more changes\n`
		}

		return report
	}

	/**
	 * Find where code came from (spatial independence demo)
	 */
	async traceCodeOrigin(codeSnippet: string): Promise<any[]> {
		const hash = SpatialHash.normalizeAndHash(codeSnippet)
		return this.recorder.findByContentHash(hash)
	}
}
