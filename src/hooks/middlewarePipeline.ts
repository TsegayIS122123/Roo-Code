// src/hooks/middlewarePipeline.ts
import { hookRegistry, HookContext, ToolResult } from "./index"

/**
 * Middleware Pipeline - The single entry point for ALL tool executions
 * This ensures EVERY tool call passes through the hook system
 */
export class MiddlewarePipeline {
	/**
	 * Execute a tool with full middleware pipeline
	 * This is the ONLY way tools should be executed in the extension
	 */
	static async executeTool(
		toolName: string,
		args: any,
		session: any,
		next: () => Promise<ToolResult>,
	): Promise<ToolResult> {
		// Create hook context with all required fields
		const context: HookContext = {
			toolName,
			args,
			session: {
				intentId: session?.intentId,
				fileSnapshots: session?.fileSnapshots || new Map<string, string>(),
				conversationId: session?.conversationId || "unknown",
				modelId: session?.modelId,
			},
			blocked: false,
		}

		try {
			// ===== PRE-HOOK PHASE =====
			// Run all pre-hooks through the registry
			const preHookResult = await hookRegistry.executePreHooks(toolName, context)

			// Check if hooks blocked execution
			if (preHookResult.blocked) {
				// Return structured error to LLM
				return {
					success: false,
					error: preHookResult.error,
					llmError: preHookResult.llmError,
				}
			}

			// ===== EXECUTION PHASE =====
			// Execute the actual tool
			const result = await next()

			// ===== POST-HOOK PHASE =====
			// Run all post-hooks (don't await - fire and forget)
			hookRegistry.executePostHooks(toolName, preHookResult, result).catch((error) => {
				console.error("Post-hook execution failed:", error)
				// Never let post-hook failures affect the response
			})

			return result
		} catch (error) {
			// ===== FAIL-SAFE BEHAVIOR =====
			// Any error in hooks is caught and logged
			// The extension NEVER crashes from hook errors
			console.error("❌ Hook middleware error:", error)

			// Return graceful error to LLM
			return {
				success: false,
				error: {
					type: "HOOK_ERROR",
					message: "Internal hook system error",
					recoverable: true,
				},
				llmError: JSON.stringify({
					type: "HOOK_ERROR",
					message: "Internal hook system error",
					recoverable: true,
					suggestion: "Please try again or contact support",
				}),
			}
		}
	}

	/**
	 * Create a wrapped version of any tool function
	 * This makes it easy to integrate with existing code
	 */
	static wrapTool<T extends (...args: any[]) => Promise<ToolResult>>(
		toolName: string,
		toolFn: T,
		sessionGetter: () => any,
	): T {
		return (async (...args: Parameters<T>) => {
			return this.executeTool(
				toolName,
				args[0], // First arg is usually params
				sessionGetter(),
				() => toolFn(...args),
			)
		}) as T
	}
}
