// src/core/tools/SelectActiveIntentTool.ts

// Simple interface without complex inheritance
export interface Tool {
	name: string
	description: string
	inputSchema: any
	execute(params: any): Promise<any>
}

// Simple implementation
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
			// Simple implementation for now
			return {
				status: "success",
				message: `Intent ${params.intent_id} selected`,
				context: `<intent_context><id>${params.intent_id}</id></intent_context>`,
			}
		} catch (error: any) {
			return {
				status: "error",
				message: `Failed to load intent: ${error?.message || "Unknown error"}`,
			}
		}
	}
}

// Export the instance
export const selectActiveIntentTool = new SelectActiveIntentToolImpl()
