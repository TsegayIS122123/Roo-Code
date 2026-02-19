// src/__tests__/phase1-integration.test.ts
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest"
import * as fs from "fs/promises"
import * as path from "path"

describe("Phase 1: Complete Handshake Integration", () => {
	const testDir = path.join(process.cwd(), "test-workspace")
	const orchestrationDir = path.join(testDir, ".orchestration")
	const yamlPath = path.join(orchestrationDir, "active_intents.yaml")
	const tracePath = path.join(orchestrationDir, "agent_trace.jsonl")

	beforeAll(async () => {
		// Setup test workspace
		await fs.mkdir(orchestrationDir, { recursive: true })

		// Create test intent
		const testYaml = `
active_intents:
  - id: "INT-TEST-001"
    name: "Test Weather API"
    status: "ACTIVE"
    owned_scope:
      - "src/test-api/**"
    constraints:
      - "Must use test data only"
    acceptance_criteria:
      - "Unit tests pass"
`
		await fs.writeFile(yamlPath, testYaml)

		// Create some trace entries
		const traces = [
			JSON.stringify({
				id: "trace-1",
				timestamp: new Date().toISOString(),
				files: [
					{
						relative_path: "src/test-api/weather.ts",
						conversations: [
							{
								related: [
									{
										type: "specification",
										value: "INT-TEST-001",
									},
								],
							},
						],
					},
				],
			}),
		]
		await fs.writeFile(tracePath, traces.join("\n"))
	})

	afterAll(async () => {
		// Cleanup
		await fs.rm(testDir, { recursive: true, force: true })
	})

	it("should complete full handshake flow: intent selection → context injection → pre-hook validation", async () => {
		// 1. Import all needed components
		const { selectActiveIntentTool } = await import("../../core/tools/SelectActiveIntentTool")
		const { intentGatekeeper } = await import("../../hooks/preHooks")
		const { getEnhancedIntentContext } = await import("../../hooks/utils/intentLoader")

		// 2. Simulate intent selection
		const intentResult = await selectActiveIntentTool.execute({ intent_id: "INT-TEST-001" })

		expect(intentResult.status).toBe("success")
		expect(intentResult.context).toContain("<id>INT-TEST-001</id>")
		expect(intentResult.context).toContain("<constraint>Must use test data only</constraint>")

		// 3. Verify context includes recent traces
		expect(intentResult.context).toContain("<recent_activity>")
		expect(intentResult.trace_count).toBeGreaterThan(0)

		// 4. Store the context for injection (simulates what happens in the agent loop)
		const injectedContext = intentResult.context

		// 5. Simulate next LLM call with context injected
		// (In real flow, this context would be in the prompt)

		// 6. Simulate tool call with intent in session
		const toolContext = {
			toolName: "write_to_file",
			args: { path: "src/test-api/weather.ts", content: 'console.log("test");' },
			session: {
				intentId: "INT-TEST-001",
				fileSnapshots: new Map(),
				conversationId: "test-conv",
			},
			blocked: false,
		}

		// 7. Run gatekeeper pre-hook
		const gatekeeperResult = await intentGatekeeper(toolContext)

		// 8. Verify tool was NOT blocked (intent is valid)
		expect(gatekeeperResult.blocked).toBe(false)

		// 9. Verify the complete handshake
		console.log("\n=== COMPLETE HANDSHAKE VERIFIED ===")
		console.log("1. ✅ Intent selected: INT-TEST-001")
		console.log("2. ✅ Context generated with traces")
		console.log("3. ✅ XML context ready for injection")
		console.log("4. ✅ Pre-hook validated intent")
		console.log("=====================================\n")
	})

	it("should block tools when no intent selected", async () => {
		const { intentGatekeeper } = await import("../../hooks/preHooks")

		const toolContext = {
			toolName: "write_to_file",
			args: { path: "src/test-api/weather.ts", content: "test" },
			session: {
				intentId: undefined, // NO INTENT SELECTED
				fileSnapshots: new Map(),
				conversationId: "test-conv",
			},
			blocked: false,
		}

		const result = await intentGatekeeper(toolContext)

		expect(result.blocked).toBe(true)
		expect(result.error?.type).toBe("INTENT_REQUIRED")
		expect(result.error?.message).toContain("must call select_active_intent first")
	})

	it("should generate proper XML context structure", async () => {
		const { getEnhancedIntentContext } = await import("../../hooks/utils/intentLoader")

		const context = await getEnhancedIntentContext("INT-TEST-001")

		// Verify XML structure
		expect(context).toMatch(/<intent_context>/)
		expect(context).toMatch(/<id>INT-TEST-001<\/id>/)
		expect(context).toMatch(/<name>Test Weather API<\/name>/)
		expect(context).toMatch(/<constraints>/)
		expect(context).toMatch(/<constraint>Must use test data only<\/constraint>/)
		expect(context).toMatch(/<owned_scope>/)
		expect(context).toMatch(/<scope>src\/test-api\/\*\*<\/scope>/)

		// Verify well-formedness (simple check)
		const openTags = (context.match(/<[^\/][^>]*>/g) || []).length
		const closeTags = (context.match(/<\/[^>]+>/g) || []).length
		expect(openTags).toBe(closeTags)
	})
})
