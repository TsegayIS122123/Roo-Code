// src/hooks/learning/lessonRecorder.ts
import * as fs from "fs/promises"
import * as path from "path"

export interface Lesson {
	timestamp: string
	type: "success" | "failure" | "insight"
	intentId?: string
	tool?: string
	message: string
	details?: any
	resolution?: string
	tags: string[]
}

export class LessonRecorder {
	private lessonsFile: string

	constructor(workspaceRoot: string) {
		this.lessonsFile = path.join(workspaceRoot, ".orchestration", "CLAUDE.md")
	}

	/**
	 * Record a lesson learned
	 */
	async recordLesson(lesson: Omit<Lesson, "timestamp">): Promise<void> {
		const fullLesson: Lesson = {
			...lesson,
			timestamp: new Date().toISOString(),
		}

		const entry = this.formatLesson(fullLesson)
		await fs.appendFile(this.lessonsFile, entry)
	}

	/**
	 * Format lesson for CLAUDE.md
	 */
	private formatLesson(lesson: Lesson): string {
		const lines: string[] = []

		lines.push(`\n## 📚 Lesson Learned: ${new Date(lesson.timestamp).toLocaleString()}`)

		if (lesson.intentId) {
			lines.push(`- **Intent:** ${lesson.intentId}`)
		}

		if (lesson.tool) {
			lines.push(`- **Tool:** ${lesson.tool}`)
		}

		lines.push(`- **Type:** ${lesson.type}`)
		lines.push(`- **Message:** ${lesson.message}`)

		if (lesson.details) {
			lines.push(`- **Details:** \`\`\`\n${JSON.stringify(lesson.details, null, 2)}\n\`\`\``)
		}

		if (lesson.resolution) {
			lines.push(`- **Resolution:** ${lesson.resolution}`)
		}

		if (lesson.tags.length) {
			lines.push(`- **Tags:** ${lesson.tags.map((t) => `\`${t}\``).join(", ")}`)
		}

		lines.push("---")

		return lines.join("\n") + "\n"
	}

	/**
	 * Record a test failure
	 */
	async recordTestFailure(intentId: string, testName: string, error: string, suggestedFix?: string): Promise<void> {
		await this.recordLesson({
			type: "failure",
			intentId,
			tool: "test",
			message: `Test failed: ${testName}`,
			details: { error },
			resolution: suggestedFix,
			tags: ["test-failure", "needs-attention"],
		})
	}

	/**
	 * Record a successful pattern
	 */
	async recordSuccess(intentId: string, pattern: string, description: string): Promise<void> {
		await this.recordLesson({
			type: "success",
			intentId,
			message: `Pattern discovered: ${pattern}`,
			details: { description },
			tags: ["best-practice", "success-pattern"],
		})
	}

	/**
	 * Record an architectural insight
	 */
	async recordInsight(intentId: string, insight: string, implications: string[]): Promise<void> {
		await this.recordLesson({
			type: "insight",
			intentId,
			message: insight,
			details: { implications },
			tags: ["architecture", "insight"],
		})
	}

	/**
	 * Get recent lessons
	 */
	async getRecentLessons(limit: number = 10): Promise<Lesson[]> {
		try {
			const content = await fs.readFile(this.lessonsFile, "utf-8")
			const lessons: Lesson[] = []

			// Simple parsing - in production, use proper markdown parsing
			const sections = content.split("## 📚 Lesson Learned:")

			for (const section of sections.slice(1)) {
				try {
					const lines = section.split("\n")
					const lesson: Partial<Lesson> = {}

					for (const line of lines) {
						if (line.startsWith("- **Intent:**")) {
							lesson.intentId = line.replace("- **Intent:**", "").trim()
						} else if (line.startsWith("- **Type:**")) {
							lesson.type = line.replace("- **Type:**", "").trim() as any
						} else if (line.startsWith("- **Message:**")) {
							lesson.message = line.replace("- **Message:**", "").trim()
						}
					}

					if (lesson.type && lesson.message) {
						lessons.push(lesson as Lesson)
					}
				} catch {
					continue
				}
			}

			return lessons.slice(0, limit)
		} catch {
			return []
		}
	}

	/**
	 * Generate lesson summary for LLM context
	 */
	async getLessonSummary(intentId?: string): Promise<string> {
		const lessons = await this.getRecentLessons(20)

		const relevantLessons = intentId ? lessons.filter((l) => l.intentId === intentId) : lessons

		if (relevantLessons.length === 0) {
			return ""
		}

		let summary = "\n<lessons_learned>\n"
		summary += "  Based on previous attempts, remember:\n\n"

		relevantLessons.forEach((lesson) => {
			summary += `  • ${lesson.message}\n`
			if (lesson.resolution) {
				summary += `    → ${lesson.resolution}\n`
			}
		})

		summary += "</lessons_learned>\n"

		return summary
	}
}
