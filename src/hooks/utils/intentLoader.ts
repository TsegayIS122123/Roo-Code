// File: src/hooks/utils/intentLoader.ts
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

export async function loadActiveIntents(): Promise<IntentsFile> {
	try {
		const intentPath = path.join(process.cwd(), ".orchestration", "active_intents.yaml")
		const content = await fs.readFile(intentPath, "utf-8")
		return yaml.load(content) as IntentsFile
	} catch (error) {
		// Return empty if file doesn't exist yet
		return { active_intents: [] }
	}
}

export async function getIntentById(intentId: string): Promise<Intent | undefined> {
	const intents = await loadActiveIntents()
	return intents.active_intents.find((i) => i.id === intentId)
}

export async function validateIntentScope(intentId: string, filePath: string): Promise<boolean> {
	const intent = await getIntentById(intentId)
	if (!intent) return false

	return intent.owned_scope.some(
		(scope) => filePath.startsWith(scope) || new RegExp(scope.replace("*", ".*")).test(filePath),
	)
}
// Add this function to your existing intentLoader.ts
export async function getIntentContext(intentId: string): Promise<string> {
	const intent = await getIntentById(intentId)
	if (!intent) {
		return ""
	}

	return `
<intent_context>
    <id>${intent.id}</id>
    <name>${intent.name}</name>
    <status>${intent.status}</status>
    <constraints>
        ${intent.constraints.map((c) => `    <constraint>${c}</constraint>`).join("\n")}
    </constraints>
    <owned_scope>
        ${intent.owned_scope.map((s) => `    <scope>${s}</scope>`).join("\n")}
    </owned_scope>
    <acceptance_criteria>
        ${intent.acceptance_criteria.map((a) => `    <criteria>${a}</criteria>`).join("\n")}
    </acceptance_criteria>
</intent_context>`
}
