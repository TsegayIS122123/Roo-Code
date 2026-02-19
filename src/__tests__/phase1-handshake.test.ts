// src/__tests__/phase1-handshake.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest"
import * as fs from "fs/promises"
import * as path from "path"

// Mock fs
vi.mock("fs/promises")

describe("Phase 1: The Handshake - Complete Implementation", () => {
	beforeEach(() => {
		vi.resetAllMocks()
	})

	it("should load intent with recent trace history", async () => {
		// Mock YAML file
		const mockYaml = `
active_intents:
  - id: "INT-001"
    name: "Weather API"
    status: "ACTIVE"
    owned_scope: ["src/api/weather/**"]
    constraints: ["Use OpenWeather API"]
    acceptance_criteria: ["Tests pass"]
`

		// Mock trace file with related entries
		const mockTraces = [
			JSON.stringify({
				id: "trace-1",
				timestamp: "2026-02-19T10:00:00Z",
				files: [
					{
						relative_path: "src/api/weather/fetch.ts",
						conversations: [
							{
								related: [
									{
										type: "specification",
										value: "INT-001",
									},
								],
							},
						],
					},
				],
			}),
			JSON.stringify({
				id: "trace-2",
				timestamp: "2026-02-19T09:00:00Z",
				files: [
					{
						relative_path: "src/api/weather/types.ts",
						conversations: [
							{
								related: [
									{
										type: "specification",
										value: "INT-001",
									},
								],
							},
						],
					},
				],
			}),
		].join("\n")

		// Setup mocks
		;(fs.readFile as any).mockImplementation((filePath: string) => {
			if (filePath.includes("active_intents.yaml")) {
				return Promise.resolve(mockYaml)
			}
			if (filePath.includes("agent_trace.jsonl")) {
				return Promise.resolve(mockTraces)
			}
			return Promise.reject({ code: "ENOENT" })
		})

		const { getEnhancedIntentContext } = await import("../../hooks/utils/intentLoader")

		const context = await getEnhancedIntentContext("INT-001")

		// Verify XML includes intent data
		expect(context).toContain("<id>INT-001</id>")
		expect(context).toContain("<name>Weather API</name>")
		expect(context).toContain("<constraint>Use OpenWeather API</constraint>")

		// Verify XML includes recent activity
		expect(context).toContain("<recent_activity>")
		expect(context).toContain("fetch.ts")
		expect(context).toContain("types.ts")
	})

	it("should handle missing trace file gracefully", async () => {
		// Mock YAML file exists
		const mockYaml = `
active_intents:
  - id: "INT-001"
    name: "Weather API"
    status: "ACTIVE"
    owned_scope: []
    constraints: []
`

		// Mock trace file missing
		;(fs.readFile as any).mockImplementation((filePath: string) => {
			if (filePath.includes("active_intents.yaml")) {
				return Promise.resolve(mockYaml)
			}
			return Promise.reject({ code: "ENOENT" }) // Trace file missing
		})

		const { getEnhancedIntentContext } = await import("../../hooks/utils/intentLoader")

		const context = await getEnhancedIntentContext("INT-001")

		// Should still return basic intent context
		expect(context).toContain("<id>INT-001</id>")
		expect(context).not.toContain("<recent_activity>") // No traces section
	})

	it("should return XML with proper formatting for empty arrays", async () => {
		const mockYaml = `
active_intents:
  - id: "INT-001"
    name: "Weather API"
    status: "ACTIVE"
    owned_scope: []
    constraints: []
    acceptance_criteria: []
`

		;(fs.readFile as any).mockResolvedValue(mockYaml)

		const { getEnhancedIntentContext } = await import("../../hooks/utils/intentLoader")

		const context = await getEnhancedIntentContext("INT-001")

		// Should still have valid XML structure
		expect(context).toContain("<intent_context>")
		expect(context).toContain("<id>INT-001</id>")
		expect(context).toContain("<constraints>")
		expect(context).toContain("</constraints>")
		expect(context).toContain("<owned_scope>")
		expect(context).toContain("</owned_scope>")
	})

	it("should limit recent traces to 3 entries", async () => {
		const mockYaml = `
active_intents:
  - id: "INT-001"
    name: "Weather API"
    status: "ACTIVE"
    owned_scope: []
    constraints: []
`

		// Create 10 trace entries
		const traces = []
		for (let i = 0; i < 10; i++) {
			traces.push(
				JSON.stringify({
					id: `trace-${i}`,
					timestamp: `2026-02-19T${10 - i}:00:00Z`,
					files: [
						{
							relative_path: `file-${i}.ts`,
							conversations: [
								{
									related: [
										{
											type: "specification",
											value: "INT-001",
										},
									],
								},
							],
						},
					],
				}),
			)
		}

		;(fs.readFile as any).mockImplementation((filePath: string) => {
			if (filePath.includes("active_intents.yaml")) {
				return Promise.resolve(mockYaml)
			}
			if (filePath.includes("agent_trace.jsonl")) {
				return Promise.resolve(traces.join("\n"))
			}
			return Promise.reject({ code: "ENOENT" })
		})

		const { formatRecentTraces } = await import("../../hooks/utils/intentLoader")

		const tracesText = await formatRecentTraces("INT-001")

		// Count the number of file references (should be at most 3)
		const fileMatches = tracesText.match(/Modified:/g) || []
		expect(fileMatches.length).toBeLessThanOrEqual(3)
	})
})
