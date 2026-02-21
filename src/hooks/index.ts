// src/hooks/index.ts

export interface HookContext {
	toolName: string
	args: any
	session: {
		intentId?: string
		fileSnapshots: Map<string, string>
		conversationId: string
		modelId?: string
	}
	blocked: boolean
	error?: {
		type: string
		message: string
		suggestion?: string
	}
	// For LLM error responses
	llmError?: string
	// For user feedback from modals
	userFeedback?: string
}

export interface ToolResult {
	success: boolean
	data?: any
	error?: any
	llmError?: string // ADD THIS LINE
}

export type PreHook = (context: HookContext) => Promise<HookContext>
export type PostHook = (context: HookContext, result: ToolResult) => Promise<void>

export class HookRegistry {
	private preHooks: Map<string, PreHook[]> = new Map()
	private postHooks: Map<string, PostHook[]> = new Map()
	private globalPreHooks: PreHook[] = []
	private globalPostHooks: PostHook[] = []

	registerPreTool(toolName: string, hook: PreHook) {
		if (!this.preHooks.has(toolName)) {
			this.preHooks.set(toolName, [])
		}
		this.preHooks.get(toolName)!.push(hook)
	}

	registerPostTool(toolName: string, hook: PostHook) {
		if (!this.postHooks.has(toolName)) {
			this.postHooks.set(toolName, [])
		}
		this.postHooks.get(toolName)!.push(hook)
	}

	registerGlobalPre(hook: PreHook) {
		this.globalPreHooks.push(hook)
	}

	registerGlobalPost(hook: PostHook) {
		this.globalPostHooks.push(hook)
	}

	async executePreHooks(toolName: string, context: HookContext): Promise<HookContext> {
		// Start with a copy to avoid mutation issues
		let currentContext = { ...context }

		// Run global pre-hooks with individual try/catch for fail-safety
		for (const hook of this.globalPreHooks) {
			try {
				currentContext = await hook(currentContext)
				if (currentContext.blocked) break
			} catch (error) {
				console.error(`❌ Global pre-hook error:`, error)
				// Continue with next hook - fail-safe
			}
		}

		// Run tool-specific pre-hooks with individual try/catch
		const hooks = this.preHooks.get(toolName) || []
		for (const hook of hooks) {
			try {
				currentContext = await hook(currentContext)
				if (currentContext.blocked) break
			} catch (error) {
				console.error(`❌ Tool pre-hook error for ${toolName}:`, error)
				// Continue with next hook - fail-safe
			}
		}

		return currentContext
	}

	async executePostHooks(toolName: string, context: HookContext, result: ToolResult): Promise<void> {
		// Run all post-hooks but NEVER let them block - fire and forget
		const promises: Promise<void>[] = []

		// Tool-specific post-hooks
		const hooks = this.postHooks.get(toolName) || []
		for (const hook of hooks) {
			promises.push(
				hook(context, result).catch((error) => {
					console.error(`❌ Post-hook error for ${toolName}:`, error)
				}),
			)
		}

		// Global post-hooks
		for (const hook of this.globalPostHooks) {
			promises.push(
				hook(context, result).catch((error) => {
					console.error(`❌ Global post-hook error:`, error)
				}),
			)
		}

		// Fire and forget - don't await
		Promise.all(promises).catch(console.error)
	}
}

// Create and export singleton instance
export const hookRegistry = new HookRegistry()

// Export all hooks
export * from "./preHooks"
export * from "./postHooks"
