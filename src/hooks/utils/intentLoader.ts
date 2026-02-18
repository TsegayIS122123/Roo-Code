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

export async function getIntentById(intentId: string): Promise<Intent | undefined> {
	const intents = await loadActiveIntents()
	return intents.active_intents?.find((i: any) => i.id === intentId)
}

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

export async function validateIntentScope(intentId: string, filePath: string): Promise<boolean> {
	const intent = await getIntentById(intentId)
	if (!intent || !intent.owned_scope) return false

	return intent.owned_scope.some((scope: string) => {
		const pattern = scope.replace(/\*/g, ".*")
		const regex = new RegExp(`^${pattern}`)
		return regex.test(filePath)
	})
}
