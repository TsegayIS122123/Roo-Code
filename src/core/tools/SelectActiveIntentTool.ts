// src/core/tools/SelectActiveIntentTool.ts
import { getEnhancedIntentContext, getRecentTracesForIntent } from "../../hooks/utils/intentLoader"
import { getCuratedContext } from "../../hooks/utils/curatedContext"
// Simple interface without complex inheritance
export interface Tool {
	name: string
	description: string
	inputSchema: any
	execute(params: any): Promise<any>
}

// Full implementation with trace history
class SelectActiveIntentToolImpl implements Tool {
	name = "select_active_intent"
	description = "MUST be called before any code changes. Selects which business intent you're working on."

	inputSchema = {
		type: "object",
		properties: {
			intent_id: {
				type: "string",
				description: "The ID of the active intent from active_intents.yaml (e.g., 'INT-001')",
			},
		},
		required: ["intent_id"],
	}

	// Add this import at the top

	async execute(params: any): Promise<any> {
		try {
			const intentId = params.intent_id

			// Use CURATED context instead of enhanced context
			// This solves the "curated not dumped" requirement
			const context = await getCuratedContext(intentId, "select_active_intent")

			if (!context || context.trim() === "") {
				return {
					status: "error",
					message: `Intent ${intentId} not found in active_intents.yaml`,
					suggestion: "Check .orchestration/active_intents.yaml for valid intent IDs",
				}
			}

			// Return success with curated context
			return {
				status: "success",
				message: `✅ Intent ${intentId} selected successfully`,
				context: context, // Now this is CURATED (limited constraints)
				timestamp: new Date().toISOString(),
				intent_id: intentId,
			}
		} catch (error: any) {
			return {
				status: "error",
				message: `Failed to load intent: ${error?.message || "Unknown error"}`,
				suggestion: "Check that .orchestration/active_intents.yaml exists and is valid",
			}
		}
	}

	/**
	 * Helper method to validate if an intent exists
	 */
	async intentExists(intentId: string): Promise<boolean> {
		try {
			const context = await getEnhancedIntentContext(intentId)
			return context !== "" && context.includes(`<id>${intentId}</id>`)
		} catch {
			return false
		}
	}
}

// Export the instance
export const selectActiveIntentTool = new SelectActiveIntentToolImpl()

// Also export the class for testing
export { SelectActiveIntentToolImpl }
