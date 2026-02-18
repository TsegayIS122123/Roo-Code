// src/hooks/integration.ts
/**
 * HOOK INTEGRATION POINT
 * This file shows how hooks are integrated into the agent loop
 * The actual integration will happen in the main execution file
 */

import { hookRegistry } from "./index"
import { intentGatekeeper, commandClassifier, scopeEnforcer } from "./preHooks"
import { traceRecorder, lessonRecorder } from "./postHooks"

/**
 * Initialize all hooks
 * Call this when the extension starts
 */
export function initializeHooks() {
	console.log("🔌 Initializing Hook Engine...")

	// Register pre-hooks
	hookRegistry.registerPreTool("execute_command", intentGatekeeper)
	hookRegistry.registerPreTool("execute_command", commandClassifier)
	hookRegistry.registerPreTool("write_to_file", intentGatekeeper)
	hookRegistry.registerPreTool("write_to_file", scopeEnforcer)
	hookRegistry.registerPreTool("apply_diff", intentGatekeeper)
	hookRegistry.registerPreTool("search_and_replace", intentGatekeeper)

	// Register post-hooks
	hookRegistry.registerPostTool("write_to_file", traceRecorder)
	hookRegistry.registerPostTool("apply_diff", traceRecorder)
	hookRegistry.registerGlobalPost(lessonRecorder)

	console.log("✅ Hook Engine initialized with intent enforcement")
	console.log(`   Registered pre-hooks for: execute_command, write_to_file`)
	console.log(`   Intent gatekeeper active - all tools require intent selection`)
}

/**
 * Example of how to use hooks in tool execution
 * This pattern should be implemented in the main execution loop
 */
export async function executeToolWithHooks(
	toolName: string,
	args: any,
	session: { intentId?: string; fileSnapshots?: Map<string, string> },
) {
	// Create hook context
	const context = {
		toolName,
		args,
		session: {
			intentId: session.intentId,
			fileSnapshots: session.fileSnapshots || new Map(),
			conversationId: `conv-${Date.now()}`,
		},
		blocked: false,
	}

	// Execute pre-hooks
	const finalContext = await hookRegistry.executePreHooks(toolName, context)

	// If blocked, return error
	if (finalContext.blocked) {
		return {
			status: "error",
			error: finalContext.error,
		}
	}

	// Tool would execute here
	const result = { success: true }

	// Execute post-hooks
	await hookRegistry.executePostHooks(toolName, finalContext, result)

	return result
}
