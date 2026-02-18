// src/__tests__/intent-handshake.integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import * as fs from "fs/promises"
import * as path from "path"
import { execSync } from "child_process"

describe("Intent Handshake - Integration Tests", () => {
	const testDir = path.join(process.cwd(), "test-workspace")
	const orchestrationDir = path.join(testDir, ".orchestration")
	const yamlPath = path.join(orchestrationDir, "active_intents.yaml")
	const tracePath = path.join(orchestrationDir, "agent_trace.jsonl")

	beforeAll(async () => {
		// Setup test workspace
		await fs.mkdir(testDir, { recursive: true })
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
      - "Tests pass"
`
		await fs.writeFile(yamlPath, testYaml)
	})

	afterAll(async () => {
		// Cleanup
		await fs.rm(testDir, { recursive: true, force: true })
	})

	it("should load intent from YAML file", async () => {
		const { loadActiveIntents, getIntentById } = await import("../../hooks/utils/intentLoader")

		const intents = await loadActiveIntents()
		expect(intents.active_intents).toHaveLength(1)
		expect(intents.active_intents[0].id).toBe("INT-TEST-001")

		const intent = await getIntentById("INT-TEST-001")
		expect(intent).toBeDefined()
		expect(intent?.name).toBe("Test Weather API")
	})

	it("should generate XML context from intent", async () => {
		const { getIntentContext } = await import("../../hooks/utils/intentLoader")

		const xml = await getIntentContext("INT-TEST-001")

		expect(xml).toContain("<intent_context>")
		expect(xml).toContain("<id>INT-TEST-001</id>")
		expect(xml).toContain("<name>Test Weather API</name>")
		expect(xml).toContain("<constraint>Must use test data only</constraint>")
		expect(xml).toContain("<scope>src/test-api/**</scope>")
	})

	it("should validate file scope correctly", async () => {
		const { validateIntentScope } = await import("../../hooks/utils/intentLoader")

		// Valid files
		expect(await validateIntentScope("INT-TEST-001", "src/test-api/weather.ts")).toBe(true)
		expect(await validateIntentScope("INT-TEST-001", "src/test-api/subdir/file.ts")).toBe(true)

		// Invalid files
		expect(await validateIntentScope("INT-TEST-001", "src/other/file.ts")).toBe(false)
		expect(await validateIntentScope("INT-TEST-001", "test-api/file.ts")).toBe(false)
	})

	it("should block writes outside scope", async () => {
		const { scopeEnforcer } = await import("../../hooks/preHooks")

		const context = {
			toolName: "write_to_file",
			args: { path: "src/other/file.ts", content: "test" },
			session: { intentId: "INT-TEST-001", fileSnapshots: new Map(), conversationId: "test" },
			blocked: false,
		}

		const result = await scopeEnforcer(context)
		expect(result.blocked).toBe(true)
		expect(result.error?.type).toBe("SCOPE_VIOLATION")
	})

	it("should allow writes inside scope", async () => {
		const { scopeEnforcer } = await import("../../hooks/preHooks")

		const context = {
			toolName: "write_to_file",
			args: { path: "src/test-api/weather.ts", content: "test" },
			session: { intentId: "INT-TEST-001", fileSnapshots: new Map(), conversationId: "test" },
			blocked: false,
		}

		const result = await scopeEnforcer(context)
		expect(result.blocked).toBe(false)
	})

	it("should record trace after successful write", async () => {
		const { traceRecorder } = await import("../../hooks/postHooks")

		const context = {
			toolName: "write_to_file",
			args: { path: "src/test-api/weather.ts", content: 'console.log("test");' },
			session: { intentId: "INT-TEST-001", fileSnapshots: new Map(), conversationId: "test" },
			blocked: false,
		}

		const result = { success: true }

		await traceRecorder(context, result)

		// Check trace file exists
		const traceExists = await fs
			.access(tracePath)
			.then(() => true)
			.catch(() => false)
		expect(traceExists).toBe(true)

		// Read trace file
		const traceContent = await fs.readFile(tracePath, "utf-8")
		const lines = traceContent.trim().split("\n")

		expect(lines.length).toBeGreaterThan(0)

		const lastTrace = JSON.parse(lines[lines.length - 1])
		expect(lastTrace.files[0].relative_path).toBe("src/test-api/weather.ts")
		expect(lastTrace.files[0].conversations[0].related[0].value).toBe("INT-TEST-001")
	})

	it("should handle complete end-to-end flow", async () => {
		// This test simulates the full handshake flow

		// 1. Load intent from YAML
		const { getIntentContext, validateIntentScope } = await import("../../hooks/utils/intentLoader")
		const { intentGatekeeper, scopeEnforcer } = await import("../../hooks/preHooks")
		const { traceRecorder } = await import("../../hooks/postHooks")

		// 2. Simulate intent selection
		const xmlContext = await getIntentContext("INT-TEST-001")
		expect(xmlContext).toContain("<intent_context>")

		// 3. Simulate tool call with intent in session
		const preContext = {
			toolName: "write_to_file",
			args: { path: "src/test-api/weather.ts", content: 'console.log("test");' },
			session: { intentId: "INT-TEST-001", fileSnapshots: new Map(), conversationId: "test" },
			blocked: false,
		}

		// 4. Run pre-hooks
		const gatekeeperResult = await intentGatekeeper(preContext)
		expect(gatekeeperResult.blocked).toBe(false)

		const scopeResult = await scopeEnforcer(preContext)
		expect(scopeResult.blocked).toBe(false)

		// 5. Simulate successful execution
		const execResult = { success: true }

		// 6. Run post-hooks
		await traceRecorder(preContext, execResult)

		// 7. Verify trace was recorded
		const traceContent = await fs.readFile(tracePath, "utf-8")
		expect(traceContent).toContain("INT-TEST-001")
		expect(traceContent).toContain("src/test-api/weather.ts")
	})
})
