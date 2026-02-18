// src/__tests__/intent-handshake.edge-cases.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest"
import * as fs from "fs/promises"
import * as path from "path"

// Mock fs module
vi.mock("fs/promises")

describe("Intent Handshake - Edge Cases", () => {
	beforeEach(() => {
		vi.resetAllMocks()
	})

	// ===== EDGE CASE 1: Missing YAML file =====
	it("should handle missing active_intents.yaml gracefully", async () => {
		// Mock file not found
		;(fs.readFile as any).mockRejectedValue({ code: "ENOENT" })

		// Import the loader (with fresh mock)
		const { loadActiveIntents } = await import("../../hooks/utils/intentLoader")

		const result = await loadActiveIntents()

		// Should return empty array, not throw
		expect(result).toEqual({ active_intents: [] })
	})

	// ===== EDGE CASE 2: Malformed YAML =====
	it("should handle malformed YAML gracefully", async () => {
		// Mock malformed YAML content
		;(fs.readFile as any).mockResolvedValue("invalid: yaml: content: [unclosed")

		const { loadActiveIntents } = await import("../../hooks/utils/intentLoader")

		// Should not throw
		const result = await loadActiveIntents()
		expect(result).toBeDefined()
	})

	// ===== EDGE CASE 3: Missing intent ID =====
	it("should return undefined for non-existent intent", async () => {
		// Mock valid YAML but without the requested intent
		const mockYaml = `
active_intents:
  - id: "INT-002"
    name: "Other Intent"
`
		;(fs.readFile as any).mockResolvedValue(mockYaml)

		const { getIntentById } = await import("../../hooks/utils/intentLoader")

		const result = await getIntentById("INT-001")
		expect(result).toBeUndefined()
	})

	// ===== EDGE CASE 4: Empty owned_scope =====
	it("should handle intent with empty owned_scope", async () => {
		const mockYaml = `
active_intents:
  - id: "INT-001"
    name: "Test Intent"
    owned_scope: []
    constraints: []
`
		;(fs.readFile as any).mockResolvedValue(mockYaml)

		const { validateIntentScope } = await import("../../hooks/utils/intentLoader")

		// Should return false for any file
		const result = await validateIntentScope("INT-001", "any/file.ts")
		expect(result).toBe(false)
	})

	// ===== EDGE CASE 5: Special characters in file paths =====
	it("should handle special characters in file paths for scope validation", async () => {
		const mockYaml = `
active_intents:
  - id: "INT-001"
    name: "Test Intent"
    owned_scope:
      - "src/api/**/*.ts"
      - "src/utils/[test]/index.js"
`
		;(fs.readFile as any).mockResolvedValue(mockYaml)

		const { validateIntentScope } = await import("../../hooks/utils/intentLoader")

		// Test various paths
		expect(await validateIntentScope("INT-001", "src/api/weather/get.ts")).toBe(true)
		expect(await validateIntentScope("INT-001", "src/api/weather/post.ts")).toBe(true)
		expect(await validateIntentScope("INT-001", "src/utils/[test]/index.js")).toBe(true)
		expect(await validateIntentScope("INT-001", "src/utils/other/file.js")).toBe(false)
	})

	// ===== EDGE CASE 6: Intent gatekeeper with missing session =====
	it("should block tools when no intent in session", async () => {
		const { intentGatekeeper } = await import("../../hooks/preHooks")

		const context = {
			toolName: "write_to_file",
			args: { path: "test.ts", content: "test" },
			session: { intentId: undefined, fileSnapshots: new Map(), conversationId: "test" },
			blocked: false,
		}

		const result = await intentGatekeeper(context)

		expect(result.blocked).toBe(true)
		expect(result.error?.type).toBe("INTENT_REQUIRED")
	})

	// ===== EDGE CASE 7: Intent gatekeeper allows intent tool itself =====
	it("should allow select_active_intent tool even without intent", async () => {
		const { intentGatekeeper } = await import("../../hooks/preHooks")

		const context = {
			toolName: "select_active_intent",
			args: { intent_id: "INT-001" },
			session: { intentId: undefined, fileSnapshots: new Map(), conversationId: "test" },
			blocked: false,
		}

		const result = await intentGatekeeper(context)

		expect(result.blocked).toBe(false) // Should not block
	})

	// ===== EDGE CASE 8: Command classifier detects destructive patterns =====
	it("should detect various destructive command patterns", async () => {
		const { commandClassifier } = await import("../../hooks/preHooks")

		const destructiveCommands = [
			"rm -rf /",
			"git push --force",
			"DROP TABLE users",
			"format C:",
			"chmod 777 /etc/passwd",
			"dd if=/dev/zero of=/dev/sda",
			"mkfs.ext4 /dev/sdb",
		]

		for (const cmd of destructiveCommands) {
			const context = {
				toolName: "execute_command",
				args: { command: cmd },
				session: { intentId: "INT-001", fileSnapshots: new Map(), conversationId: "test" },
				blocked: false,
			}

			const result = await commandClassifier(context)
			expect(result.blocked).toBe(true)
			expect(result.error?.type).toBe("DESTRUCTIVE_COMMAND")
		}
	})

	// ===== EDGE CASE 9: Safe commands pass classifier =====
	it("should allow safe commands through classifier", async () => {
		const { commandClassifier } = await import("../../hooks/preHooks")

		const safeCommands = ["npm install", "git status", "ls -la", "cat file.txt", 'echo "hello"', "pnpm test"]

		for (const cmd of safeCommands) {
			const context = {
				toolName: "execute_command",
				args: { command: cmd },
				session: { intentId: "INT-001", fileSnapshots: new Map(), conversationId: "test" },
				blocked: false,
			}

			const result = await commandClassifier(context)
			expect(result.blocked).toBe(false)
		}
	})

	// ===== EDGE CASE 10: Trace recorder handles missing content =====
	it("should handle missing content gracefully in trace recorder", async () => {
		const { traceRecorder } = await import("../../hooks/postHooks")

		const context = {
			toolName: "write_to_file",
			args: { path: "test.ts", content: undefined },
			session: { intentId: "INT-001", fileSnapshots: new Map(), conversationId: "test" },
			blocked: false,
		}

		const result = { success: true }

		// Should not throw
		await expect(traceRecorder(context, result)).resolves.toBeUndefined()
	})

	// ===== EDGE CASE 11: XML context generation with missing fields =====
	it("should generate valid XML even with missing intent fields", async () => {
		const mockYaml = `
active_intents:
  - id: "INT-001"
    name: "Test Intent"
    # missing constraints and owned_scope
`
		;(fs.readFile as any).mockResolvedValue(mockYaml)

		const { getIntentContext } = await import("../../hooks/utils/intentLoader")

		const xml = await getIntentContext("INT-001")

		// Should still generate basic structure
		expect(xml).toContain("<intent_context>")
		expect(xml).toContain("<id>INT-001</id>")
		expect(xml).toContain("<name>Test Intent</name>")
	})

	// ===== EDGE CASE 12: Multiple concurrent intent selections =====
	it("should handle multiple concurrent intent selections", async () => {
		const mockYaml = `
active_intents:
  - id: "INT-001"
    name: "Weather API"
    owned_scope: ["src/api/weather/**"]
  - id: "INT-002"
    name: "Auth System"
    owned_scope: ["src/auth/**"]
`
		;(fs.readFile as any).mockResolvedValue(mockYaml)

		const { getIntentById } = await import("../../hooks/utils/intentLoader")

		// Get both intents concurrently
		const [intent1, intent2] = await Promise.all([getIntentById("INT-001"), getIntentById("INT-002")])

		expect(intent1?.id).toBe("INT-001")
		expect(intent1?.name).toBe("Weather API")
		expect(intent2?.id).toBe("INT-002")
		expect(intent2?.name).toBe("Auth System")
	})
})
