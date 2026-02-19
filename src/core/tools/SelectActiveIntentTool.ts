// src/core/tools/SelectActiveIntentTool.ts
import { getEnhancedIntentContext, getRecentTracesForIntent } from "../../hooks/utils/intentLoader"

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

	async execute(params: any): Promise<any> {
		try {
			const intentId = params.intent_id

			// Load enhanced intent context with trace history
			const context = await getEnhancedIntentContext(intentId)

			if (!context || context.trim() === "" || !context.includes(`<id>${intentId}</id>`)) {
				return {
					status: "error",
					message: `Intent ${intentId} not found in active_intents.yaml`,
					suggestion: "Check .orchestration/active_intents.yaml for valid intent IDs",
				}
			}

			// Load recent traces for metadata
			const recentTraces = await getRecentTracesForIntent(intentId, 3)

			// Return success with full context
			return {
				status: "success",
				message: `✅ Intent ${intentId} selected successfully`,
				context: context, // Full XML context with constraints, scope, and traces
				trace_count: recentTraces.length,
				timestamp: new Date().toISOString(),
				intent_id: intentId,

				// Include summary for debugging
				summary: {
					id: intentId,
					trace_count: recentTraces.length,
					has_constraints: context.includes("<constraints>"),
					has_scope: context.includes("<owned_scope>"),
					has_traces: context.includes("<recent_activity>"),
				},
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
