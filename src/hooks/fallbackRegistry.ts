// src/hooks/fallbackRegistry.ts
import { HookRegistry, hookRegistry as mainRegistry, HookContext, ToolResult } from "./index"

/**
 * FallbackRegistry - Ensures hooks never crash the extension
 * This wraps the main registry with comprehensive error handling
 */
export class FallbackRegistry {
	private static instance: FallbackRegistry
	private primaryRegistry: HookRegistry
	private fallbackMode = false

	private constructor() {
		this.primaryRegistry = mainRegistry
		this.startHealthCheck()
	}

	static getInstance(): FallbackRegistry {
		if (!FallbackRegistry.instance) {
			FallbackRegistry.instance = new FallbackRegistry()
		}
		return FallbackRegistry.instance
	}

	/**
	 * Execute pre-hooks with fail-safe wrapper
	 */
	async executePreHooks(toolName: string, context: HookContext): Promise<HookContext> {
		try {
			// Try primary registry
			if (!this.fallbackMode) {
				return await this.primaryRegistry.executePreHooks(toolName, context)
			}
		} catch (error) {
			console.error(`❌ Hook registry error for ${toolName}, entering fallback mode:`, error)
			this.fallbackMode = true
		}

		// Fallback mode - allow execution without hooks
		// Return context with warning but NOT blocked
		return {
			...context,
			blocked: false,
			userFeedback: "⚠️ Hooks temporarily disabled due to error",
			error: undefined,
		}
	}

	/**
	 * Execute post-hooks with fail-safe wrapper
	 */
	async executePostHooks(toolName: string, context: HookContext, result: ToolResult): Promise<void> {
		try {
			if (!this.fallbackMode) {
				await this.primaryRegistry.executePostHooks(toolName, context, result)
			}
		} catch (error) {
			console.error(`❌ Post-hook error for ${toolName}:`, error)
			// Never throw - just log
		}
	}

	/**
	 * Health check to recover from fallback mode
	 */
	private startHealthCheck(): void {
		setInterval(async () => {
			if (this.fallbackMode) {
				try {
					// Create a proper test context with all required fields
					const testContext: HookContext = {
						toolName: "health_check",
						args: {},
						session: {
							intentId: undefined,
							fileSnapshots: new Map<string, string>(),
							conversationId: "health-check",
							modelId: undefined,
						},
						blocked: false,
					}

					// Test the primary registry
					await this.primaryRegistry.executePreHooks("health_check", testContext)

					// If successful, exit fallback mode
					this.fallbackMode = false
					console.log("✅ Hook registry recovered, exiting fallback mode")
				} catch (error) {
					// Still failing, stay in fallback mode
					console.log("🔄 Hook registry still in fallback mode")
				}
			}
		}, 60000) // Check every minute
	}

	/**
	 * Check if in fallback mode
	 */
	isInFallbackMode(): boolean {
		return this.fallbackMode
	}
}
