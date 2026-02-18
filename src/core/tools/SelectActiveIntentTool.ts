// File: src/core/tools/SelectActiveIntentTool.ts
import { BaseTool } from "./BaseTool"

interface SelectActiveIntentParams {
	intent_id: string
}

export class SelectActiveIntentTool extends BaseTool<"select_active_intent"> {
	readonly name = "select_active_intent" as const
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
		// Phase 1 will implement actual logic
		return {
			status: "success",
			message: `Intent ${params.intent_id} selected`,
		}
	}
}

export const selectActiveIntentTool = new SelectActiveIntentTool()
