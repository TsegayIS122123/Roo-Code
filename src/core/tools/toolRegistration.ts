// src/core/tools/toolRegistration.ts
/**
 * TOOL REGISTRATION - Shows how select_active_intent is integrated
 */

// Simple interface for tool definition
interface ToolDefinition {
	name: string
	description: string
}

// Import the tool - use type assertion to avoid errors
import { selectActiveIntentTool } from "./SelectActiveIntentTool"

/**
 * All available tools including our new intent selection tool
 */
export const ALL_TOOLS: ToolDefinition[] = [
	// INTENT TOOL - This MUST be called first
	{
		name: (selectActiveIntentTool as any).name || "select_active_intent",
		description: (selectActiveIntentTool as any).description || "Select active intent tool",
	},

	// Placeholders for other tools
	{
		name: "execute_command",
		description: "Execute a command in the terminal",
	},
	{
		name: "write_to_file",
		description: "Write content to a file",
	},
]

/**
 * Returns tool definitions for system prompt injection
 */
export function getToolDefinitions(): string {
	return ALL_TOOLS.map((tool) => {
		return `- ${tool.name}: ${tool.description}`
	}).join("\n")
}

/**
 * Validates that intent tool is available
 */
export function isIntentToolAvailable(): boolean {
	return ALL_TOOLS.some((tool) => tool.name === "select_active_intent")
}
