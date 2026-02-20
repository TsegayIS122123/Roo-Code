// src/hooks/security/commandClassifier.ts
import { DESTRUCTIVE_PATTERNS, SAFE_PATTERNS, CommandClassification } from "../types/commandTypes"

export class CommandClassifier {
	/**
	 * Classify a command as safe or destructive
	 */
	static classify(command: string): CommandClassification {
		// Check destructive patterns first
		for (const pattern of DESTRUCTIVE_PATTERNS) {
			if (pattern.pattern.test(command)) {
				return {
					risk: "destructive",
					reason: pattern.reason,
					pattern: pattern.pattern.source,
					suggestedAlternative: pattern.alternative,
				}
			}
		}

		// Check safe patterns
		for (const pattern of SAFE_PATTERNS) {
			if (pattern.pattern.test(command)) {
				return {
					risk: "safe",
					reason: pattern.reason,
				}
			}
		}

		// Default to unknown
		return {
			risk: "unknown",
			reason: "Command not recognized in safe/destructive patterns",
		}
	}

	/**
	 * Get user-friendly warning message
	 */
	static getWarningMessage(command: string, classification: CommandClassification): string {
		const messages: string[] = [
			`⚠️ **DESTRUCTIVE COMMAND DETECTED**`,
			`Command: \`${command}\``,
			`Risk: ${classification.reason}`,
		]

		if (classification.suggestedAlternative) {
			messages.push(`\nSuggested alternative: ${classification.suggestedAlternative}`)
		}

		messages.push("\nDo you want to allow this command?")

		return messages.join("\n")
	}

	/**
	 * Check if command is allowed based on intent permissions
	 */
	static async isAllowedForIntent(command: string, intentId: string): Promise<boolean> {
		const classification = this.classify(command)

		// If safe, always allowed
		if (classification.risk === "safe") {
			return true
		}

		// If destructive, check intent permissions
		const { getIntentById } = await import("../utils/intentLoader")
		const intent = await getIntentById(intentId)

		// Check if intent has allow_destructive flag
		return !!(intent as any)?.allow_destructive === true
	}
}

// Export both the class and a default instance if needed
export const commandClassifier = CommandClassifier
