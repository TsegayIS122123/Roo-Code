// src/hooks/index.ts

export interface HookContext {
	toolName: string
	args: any
	session: {
		intentId?: string
		fileSnapshots: Map<string, string>
		conversationId: string
	}
	blocked: boolean
	error?: {
		type: string
		message: string
		suggestion?: string
	}
	// NEW: For LLM error responses
	llmError?: string
	// NEW: For user feedback from modals
	userFeedback?: string
}

export interface ToolResult {
	success: boolean
	data?: any
	error?: any
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
		// Run global pre-hooks
		for (const hook of this.globalPreHooks) {
			context = await hook(context)
			if (context.blocked) break
		}

		// Run tool-specific pre-hooks
		const hooks = this.preHooks.get(toolName) || []
		for (const hook of hooks) {
			context = await hook(context)
			if (context.blocked) break
		}

		return context
	}

	async executePostHooks(toolName: string, context: HookContext, result: ToolResult): Promise<void> {
		const hooks = this.postHooks.get(toolName) || []
		for (const hook of hooks) {
			await hook(context, result)
		}
		for (const hook of this.globalPostHooks) {
			await hook(context, result)
		}
	}
}

// Create and export singleton instance
export const hookRegistry = new HookRegistry()

// Export all hooks
export * from "./preHooks"
export * from "./postHooks"
