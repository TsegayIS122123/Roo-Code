// File: src/hooks/preHooks.ts
import { HookContext, PreHook } from "./index"

export const intentGatekeeper: PreHook = async (context: HookContext) => {
	// Skip check for select_active_intent tool itself
	if (context.toolName === "select_active_intent") {
		return context
	}

	// For all other tools, verify intent is selected
	if (!context.session.intentId) {
		context.blocked = true
		context.error = {
			type: "INTENT_REQUIRED",
			message: "You must call select_active_intent first",
			suggestion: "Analyze the user request and call select_active_intent with the appropriate intent_id",
		}
	}

	return context
}

export const commandClassifier: PreHook = async (context: HookContext) => {
	if (context.toolName !== "execute_command") {
		return context
	}

	const DESTRUCTIVE_PATTERNS = [/rm -rf/, /git push --force/, /drop table/i, /format/, /delete/, /chmod 777/]

	const command = context.args.command
	const isDestructive = DESTRUCTIVE_PATTERNS.some((pattern) => pattern.test(command))

	if (isDestructive) {
		context.blocked = true
		context.error = {
			type: "DESTRUCTIVE_COMMAND",
			message: "Destructive command blocked",
			suggestion: "This command requires explicit user approval",
		}
	}

	return context
}
