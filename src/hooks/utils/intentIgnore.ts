// src/hooks/utils/intentIgnore.ts
import * as fs from "fs/promises"
import * as path from "path"
// Change to default import
import ignore from "ignore"

export interface IntentIgnoreRule {
	pattern: string
	type: "exclude" | "allow_destructive" | "require_approval"
	intent_id?: string
	comment?: string
}

export class IntentIgnoreManager {
	private static instance: IntentIgnoreManager
	private ignorer: ReturnType<typeof ignore>
	private rules: IntentIgnoreRule[] = []
	private filePath: string

	private constructor() {
		this.ignorer = ignore()
		this.filePath = path.join(process.cwd(), ".intentignore")
	}

	static async getInstance(): Promise<IntentIgnoreManager> {
		if (!IntentIgnoreManager.instance) {
			IntentIgnoreManager.instance = new IntentIgnoreManager()
			await IntentIgnoreManager.instance.load()
		}
		return IntentIgnoreManager.instance
	}

	/**
	 * Load .intentignore file
	 */
	async load(): Promise<void> {
		try {
			const content = await fs.readFile(this.filePath, "utf-8")
			await this.parse(content)
		} catch {
			// File doesn't exist, use defaults
			this.setupDefaults()
		}
	}

	/**
	 * Parse .intentignore content
	 */
	private async parse(content: string): Promise<void> {
		const lines = content.split("\n")
		this.rules = []
		const patterns: string[] = []

		for (const line of lines) {
			const trimmed = line.trim()

			// Skip comments and empty lines
			if (!trimmed || trimmed.startsWith("#")) {
				continue
			}

			// Parse rule
			const rule = this.parseRule(trimmed)
			if (rule) {
				this.rules.push(rule)
				if (rule.type === "exclude") {
					patterns.push(rule.pattern)
				}
			}
		}

		// Add all patterns to ignorer
		this.ignorer.add(patterns)
	}

	/**
	 * Parse a single rule line
	 * Format: [intent_id:]pattern [type] [# comment]
	 */
	private parseRule(line: string): IntentIgnoreRule | null {
		// Remove inline comment
		const [rulePart] = line.split("#").map((s) => s.trim())
		if (!rulePart) return null

		// Split into parts
		const parts = rulePart.split(/\s+/)
		if (parts.length === 0) return null

		let pattern: string
		let type: "exclude" | "allow_destructive" | "require_approval" = "exclude"
		let intent_id: string | undefined

		// Check if first part is intent_id:pattern
		if (parts[0].includes(":")) {
			const [id, ...patternParts] = parts[0].split(":")
			intent_id = id
			pattern = patternParts.join(":")
		} else {
			pattern = parts[0]
		}

		// Check for type override
		if (parts.length > 1) {
			if (parts[1] === "allow_destructive") {
				type = "allow_destructive"
			} else if (parts[1] === "require_approval") {
				type = "require_approval"
			}
		}

		return { pattern, type, intent_id }
	}

	/**
	 * Setup default rules
	 */
	private setupDefaults(): void {
		this.rules = [
			{ pattern: "node_modules/**", type: "exclude" },
			{ pattern: ".git/**", type: "exclude" },
			{ pattern: "dist/**", type: "exclude" },
			{ pattern: "*.log", type: "exclude" },
		]

		// Add patterns to ignorer
		this.ignorer.add(this.rules.map((r) => r.pattern))
	}

	/**
	 * Check if file is excluded for intent
	 */
	async isExcluded(filePath: string, intentId?: string): Promise<boolean> {
		// Check intent-specific exclusions
		if (intentId) {
			const intentRule = this.rules.find((r) => r.intent_id === intentId && r.type === "exclude")
			if (intentRule && this.ignorer.ignores(filePath)) {
				return true
			}
		}

		// Check global exclusions
		return this.ignorer.ignores(filePath)
	}

	/**
	 * Check if intent allows destructive commands
	 */
	async allowsDestructive(intentId: string): Promise<boolean> {
		const rule = this.rules.find((r) => r.intent_id === intentId && r.type === "allow_destructive")
		return !!rule
	}

	/**
	 * Check if file requires approval for intent
	 */
	async requiresApproval(filePath: string, intentId?: string): Promise<boolean> {
		if (!intentId) return true // No intent always requires approval

		const rule = this.rules.find((r) => r.intent_id === intentId && r.type === "require_approval")

		if (rule && this.ignorer.ignores(filePath)) {
			return true
		}

		return false
	}

	/**
	 * Get rules for display
	 */
	getRules(): IntentIgnoreRule[] {
		return [...this.rules]
	}
}
