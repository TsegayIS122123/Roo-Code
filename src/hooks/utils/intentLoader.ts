// src/hooks/utils/intentLoader.ts
import * as fs from "fs/promises"
import * as path from "path"
import * as yaml from "js-yaml"

export interface Intent {
	id: string
	name: string
	status: string
	owned_scope: string[]
	constraints: string[]
	acceptance_criteria: string[]
}

export interface IntentsFile {
	active_intents: Intent[]
}

export interface TraceEntry {
	id: string
	timestamp: string
	files: Array<{
		relative_path: string
		conversations?: Array<{
			related?: Array<{
				type: string
				value: string
			}>
		}>
	}>
}

/**
 * Load active intents from YAML file
 */
export async function loadActiveIntents(): Promise<IntentsFile> {
	try {
		const intentPath = path.join(process.cwd(), ".orchestration", "active_intents.yaml")
		const content = await fs.readFile(intentPath, "utf-8")
		const data = yaml.load(content) as IntentsFile
		return data || { active_intents: [] }
	} catch {
		return { active_intents: [] }
	}
}

/**
 * Get intent by ID
 */
export async function getIntentById(intentId: string): Promise<Intent | undefined> {
	const intents = await loadActiveIntents()
	return intents.active_intents?.find((i: any) => i.id === intentId)
}

/**
 * Load recent trace entries for a specific intent
 */
export async function getRecentTracesForIntent(intentId: string, limit: number = 3): Promise<TraceEntry[]> {
	try {
		const tracePath = path.join(process.cwd(), ".orchestration", "agent_trace.jsonl")

		// Check if file exists
		try {
			await fs.access(tracePath)
		} catch {
			return [] // No trace file yet
		}

		const content = await fs.readFile(tracePath, "utf-8")
		const lines = content
			.trim()
			.split("\n")
			.filter((line) => line.trim())

		// Parse lines and filter for this intent
		const traces: TraceEntry[] = []

		// Read backwards (most recent first)
		for (let i = lines.length - 1; i >= 0; i--) {
			try {
				const trace = JSON.parse(lines[i]) as TraceEntry

				// Check if this trace relates to our intent
				const hasIntent = trace.files?.some((file) =>
					file.conversations?.some((conv) =>
						conv.related?.some((rel) => rel.type === "specification" && rel.value === intentId),
					),
				)

				if (hasIntent) {
					traces.push(trace)
					if (traces.length >= limit) break
				}
			} catch (e) {
				// Skip malformed lines
				continue
			}
		}

		return traces
	} catch (error) {
		console.error("Error loading traces:", error)
		return []
	}
}

/**
 * Format recent traces as readable text for context
 */
export async function formatRecentTraces(intentId: string): Promise<string> {
	const traces = await getRecentTracesForIntent(intentId, 3)

	if (traces.length === 0) {
		return ""
	}

	let output = "\n    <recent_activity>\n"

	traces.forEach((trace, index) => {
		const date = new Date(trace.timestamp).toLocaleString()
		output += `        <!-- Activity ${index + 1} (${date}) -->\n`

		trace.files?.forEach((file) => {
			output += `        <modified_file path="${file.relative_path}" />\n`
		})
	})

	output += "    </recent_activity>\n"
	return output
}

/**
 * Get basic intent context XML
 */
export async function getIntentContext(intentId: string): Promise<string> {
	const intent = await getIntentById(intentId)
	if (!intent) return ""

	return `
<intent_context>
    <id>${intent.id}</id>
    <name>${intent.name}</name>
    <status>${intent.status}</status>
    <constraints>
        ${(intent.constraints || []).map((c: string) => `    <constraint>${c}</constraint>`).join("\n")}
    </constraints>
    <owned_scope>
        ${(intent.owned_scope || []).map((s: string) => `    <scope>${s}</scope>`).join("\n")}
    </owned_scope>
</intent_context>`
}

/**
 * Enhanced context generator with trace history
 */
export async function getEnhancedIntentContext(intentId: string): Promise<string> {
	const intent = await getIntentById(intentId)
	if (!intent) return ""

	const traces = await formatRecentTraces(intentId)

	// Build constraints section
	const constraintsSection =
		(intent.constraints || []).length > 0
			? `    <constraints>
        ${(intent.constraints || []).map((c: string) => `    <constraint>${c}</constraint>`).join("\n")}
    </constraints>`
			: "    <constraints />"

	// Build scope section
	const scopeSection =
		(intent.owned_scope || []).length > 0
			? `    <owned_scope>
        ${(intent.owned_scope || []).map((s: string) => `    <scope>${s}</scope>`).join("\n")}
    </owned_scope>`
			: "    <owned_scope />"

	// Build criteria section
	const criteriaSection =
		(intent.acceptance_criteria || []).length > 0
			? `    <acceptance_criteria>
        ${(intent.acceptance_criteria || []).map((a: string) => `    <criteria>${a}</criteria>`).join("\n")}
    </acceptance_criteria>`
			: "    <acceptance_criteria />"

	return `
<intent_context>
    <id>${intent.id}</id>
    <name>${intent.name}</name>
    <status>${intent.status}</status>
    
${constraintsSection}
    
${scopeSection}
    
${criteriaSection}
${traces}
</intent_context>`
}

/**
 * Validate if a file path is within intent's owned scope
 */
export async function validateIntentScope(intentId: string, filePath: string): Promise<boolean> {
	const intent = await getIntentById(intentId)
	if (!intent || !intent.owned_scope) return false

	return intent.owned_scope.some((scope: string) => {
		// Convert glob pattern to regex
		const pattern = scope.replace(/\./g, "\\.").replace(/\*/g, ".*").replace(/\?/g, ".")
		const regex = new RegExp(`^${pattern}`)
		return regex.test(filePath)
	})
}
