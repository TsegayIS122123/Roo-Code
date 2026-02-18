// src/core/tools/SelectActiveIntentTool.ts
import { BaseTool } from "./BaseTool"
import { getIntentContext } from "../../hooks/utils/intentLoader"

interface SelectActiveIntentParams {
	intent_id: string
}

// Use 'any' to bypass the type constraint for now
export class SelectActiveIntentTool extends BaseTool<any> {
	readonly name = "select_active_intent"
	readonly description = "MUST be called before any code changes. Selects which business intent you're working on."

	readonly inputSchema = {
		type: "object",
		properties: {
			intent_id: {
				type: "string",
				description: "The ID of the active intent from active_intents.yaml (e.g., 'INT-001')",
			},
		},
		required: ["intent_id"],
	}

	async execute(params: SelectActiveIntentParams): Promise<any> {
		try {
			// Load intent context
			const context = await getIntentContext(params.intent_id)

			if (!context || context.trim() === "") {
				return {
					status: "error",
					message: `Intent ${params.intent_id} not found in active_intents.yaml`,
				}
			}

			// Store in session (this will be used by pre-hooks)
			// Note: The actual session storage depends on your task object
			// You may need to modify this based on how Roo Code handles session

			return {
				status: "success",
				message: `Intent ${params.intent_id} selected`,
				context: context,
			}
		} catch (error) {
			return {
				status: "error",
				message: `Failed to load intent: ${error.message}`,
			}
		}
	}
}

export const selectActiveIntentTool = new SelectActiveIntentTool()
