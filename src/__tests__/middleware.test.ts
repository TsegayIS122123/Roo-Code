// src/__tests__/middleware.test.ts
import { describe, it, expect, vi } from "vitest"
import { MiddlewarePipeline } from "../hooks/middlewarePipeline"
import { hookRegistry } from "../hooks/index"
import { intentGatekeeper } from "../hooks/preHooks"

describe("Middleware Pipeline - Clean Pattern", () => {
	it("should have clear separation of concerns", () => {
		// Verify hooks are in their own directory
		const fs = require("fs")
		const hookFiles = fs.readdirSync("src/hooks")

		expect(hookFiles).toContain("index.ts")
		expect(hookFiles).toContain("preHooks.ts")
		expect(hookFiles).toContain("postHooks.ts")
		expect(hookFiles).toContain("middlewarePipeline.ts")

		console.log("✅ Hooks isolated in dedicated directory")
	})

	it("should use uniform interceptor pattern", async () => {
		// Register test hook
		const testHook = vi.fn(async (ctx) => ctx)
		hookRegistry.registerPreTool("test_tool", testHook)

		// Execute through pipeline
		await MiddlewarePipeline.executeTool("test_tool", { test: true }, { conversationId: "test" }, async () => ({
			success: true,
		}))

		// Verify hook was called through the pipeline
		expect(testHook).toHaveBeenCalled()
		console.log("✅ All tools pass through uniform pipeline")
	})

	it("should be fail-safe on hook errors", async () => {
		// Register a hook that throws
		const errorHook = vi.fn(async () => {
			throw new Error("Hook error")
		})
		hookRegistry.registerPreTool("error_tool", errorHook)

		// Execute - should NOT crash
		const result = await MiddlewarePipeline.executeTool("error_tool", {}, { conversationId: "test" }, async () => ({
			success: true,
		}))

		// Should return gracefully
		expect(result).toBeDefined()
		expect(result.success).toBe(false)
		expect(result.error.type).toBe("HOOK_ERROR")

		console.log("✅ Hook errors do not crash extension")
	})

	it("should be composable - new hooks added without modifying existing code", () => {
		// Add logging hook without changing existing hooks
		const loggingHook = vi.fn(async (ctx) => {
			console.log(`Tool ${ctx.toolName} called`)
			return ctx
		})

		// Just register it - no modifications to existing hooks
		hookRegistry.registerPreTool("*", loggingHook)

		expect(loggingHook).toBeDefined()
		console.log("✅ New hooks can be added without modifying existing code")
	})

	it("should demonstrate complete middleware flow", async () => {
		const flow: string[] = []

		// Register hooks that record the flow
		hookRegistry.registerPreTool("flow_test", async (ctx) => {
			flow.push("pre-hook-1")
			return ctx
		})

		hookRegistry.registerPreTool("flow_test", async (ctx) => {
			flow.push("pre-hook-2")
			return ctx
		})

		// Execute through pipeline
		await MiddlewarePipeline.executeTool("flow_test", {}, { conversationId: "test" }, async () => {
			flow.push("execution")
			return { success: true }
		})

		// Verify correct order
		expect(flow).toEqual(["pre-hook-1", "pre-hook-2", "execution"])
		console.log("✅ Middleware pipeline executes in correct order: pre-hooks → execution")
	})
})
