// src/hooks/utils/curatedContext.ts
import { getIntentById } from "./intentLoader"

/**
 * Generates a CURATED context block - only the most relevant information
 * NOT a full dump of the entire intent - limited to 3 constraints max
 */
export async function getCuratedContext(intentId: string, toolName?: string): Promise<string> {
	const intent = await getIntentById(intentId)
	if (!intent) return ""

	// CURATION: Limit constraints to maximum 3
	let relevantConstraints = intent.constraints || []

	// If this is a specific tool, filter to only relevant constraints
	if (toolName === "write_to_file") {
		relevantConstraints = relevantConstraints.filter(
			(c) =>
				c.toLowerCase().includes("file") ||
				c.toLowerCase().includes("path") ||
				c.toLowerCase().includes("directory"),
		)
	} else if (toolName === "execute_command") {
		relevantConstraints = relevantConstraints.filter(
			(c) =>
				c.toLowerCase().includes("command") ||
				c.toLowerCase().includes("terminal") ||
				c.toLowerCase().includes("script"),
		)
	}

	// CURATION: Take only first 3 constraints maximum
	const topConstraints = relevantConstraints.slice(0, 3)

	// Build curated XML - NOT a full dump
	return `
<intent_context>
    <id>${intent.id}</id>
    <name>${intent.name}</name>
    <status>${intent.status}</status>
    ${
		topConstraints.length > 0
			? `
    <key_constraints>
        ${topConstraints.map((c) => `        <constraint>${c}</constraint>`).join("\n")}
    </key_constraints>`
			: ""
	}
    <primary_focus>${intent.owned_scope?.[0] || "unknown"}</primary_focus>
    <message>Working on ${intent.name}. Focus on the key constraints above.</message>
</intent_context>`
}
