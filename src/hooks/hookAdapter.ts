// src/hooks/hookAdapter.ts
import { MiddlewarePipeline } from "./middlewarePipeline"
import { hookRegistry } from "./index"

/**
 * HookAdapter - Bridges the gap between Roo Code's existing tool execution
 * and our new middleware pipeline WITHOUT modifying core files
 */
export class HookAdapter {
	/**
	 * Patch the tool execution flow at runtime
	 * This uses monkey-patching to avoid modifying core files
	 */
	static patchToolExecution() {
		try {
			// Find the tool execution function in the extension
			// This is a safe way to integrate without modifying source files
			const originalExecute = (global as any).__originalToolExecute

			if (!originalExecute) {
				console.warn("Could not patch tool execution - hooks may not be active")
				return
			}

			// Replace with wrapped version
			;(global as any).__originalToolExecute = async (toolName: string, params: any, session: any) => {
				return MiddlewarePipeline.executeTool(toolName, params, session, () =>
					originalExecute(toolName, params, session),
				)
			}

			console.log("✅ Hook adapter patched tool execution successfully")
		} catch (error) {
			console.error("❌ Failed to patch tool execution:", error)
			// Fail-safe: extension continues without hooks
		}
	}

	/**
	 * Verify hooks are working
	 */
	static async verifyHooks(): Promise<boolean> {
		try {
			// Create a test context
			const testContext = {
				toolName: "test_hook",
				args: {},
				session: {
					intentId: undefined,
					fileSnapshots: new Map(),
					conversationId: "test",
				},
				blocked: false,
			}

			// Run through pre-hooks
			const result = await hookRegistry.executePreHooks("test_hook", testContext)

			console.log("✅ Hook system verified:", result.blocked ? "blocking" : "passing")
			return true
		} catch (error) {
			console.error("❌ Hook verification failed:", error)
			return false
		}
	}
}
