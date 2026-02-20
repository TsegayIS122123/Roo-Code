// src/hooks/preHooks.ts
import { HookContext, PreHook } from "./index"
import { CommandClassifier } from "./security/commandClassifier"
import { UIBlockingHandler } from "./security/uiBlocking"
import { IntentIgnoreManager } from "./utils/intentIgnore"
import { AutonomousRecovery } from "./recovery/errorHandler"
import { validateIntentScope } from "./utils/intentLoader"

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
		// Create standardized error for LLM
		context.llmError = AutonomousRecovery.createErrorResponse(AutonomousRecovery.intentRequired())
	}

	return context
}

export const commandClassifier: PreHook = async (context: HookContext) => {
	if (context.toolName !== "execute_command") {
		return context
	}

	const command = context.args.command || ""

	// Check if command is in .intentignore
	const ignoreManager = await IntentIgnoreManager.getInstance()
	if (await ignoreManager.isExcluded(command, context.session.intentId)) {
		context.blocked = true
		context.error = {
			type: "COMMAND_EXCLUDED",
			message: "Command excluded by .intentignore",
			suggestion: "Remove from .intentignore or use different approach",
		}
		return context
	}

	// Classify command
	const classification = CommandClassifier.classify(command)

	// If safe, allow
	if (classification.risk === "safe") {
		return context
	}

	// Check if intent allows destructive commands
	if (context.session.intentId) {
		const allowsDestructive = await ignoreManager.allowsDestructive(context.session.intentId)
		if (allowsDestructive) {
			return context // Allowed by intent
		}
	}

	// Show UI modal for destructive command
	const approval = await UIBlockingHandler.confirmDestructiveCommand(
		command,
		classification,
		context.session.intentId,
	)

	if (!approval.approved) {
		context.blocked = true
		context.error = {
			type: "DESTRUCTIVE_COMMAND",
			message: `Destructive command blocked: ${command}`,
			suggestion: classification.suggestedAlternative || "Request explicit user approval",
		}
		context.llmError = AutonomousRecovery.createErrorResponse(
			AutonomousRecovery.destructiveCommand(command, classification.suggestedAlternative),
		)
	}

	// Store feedback if provided
	if (approval.feedback) {
		context.userFeedback = approval.feedback
	}

	return context
}

export const scopeEnforcer: PreHook = async (context: HookContext) => {
	if (context.toolName !== "write_to_file" || !context.session.intentId) {
		return context
	}

	const filePath = context.args.path

	// Check if file is in .intentignore
	const ignoreManager = await IntentIgnoreManager.getInstance()
	if (await ignoreManager.isExcluded(filePath, context.session.intentId)) {
		context.blocked = true
		context.error = {
			type: "FILE_EXCLUDED",
			message: `File ${filePath} excluded by .intentignore`,
			suggestion: "Remove from .intentignore or choose different file",
		}
		return context
	}

	// Validate against intent's owned_scope
	const isValid = await validateIntentScope(context.session.intentId, filePath)

	if (!isValid) {
		// Load intent to get allowed scopes
		const { getIntentById } = await import("./utils/intentLoader")
		const intent = await getIntentById(context.session.intentId)
		const allowedScopes = intent?.owned_scope || []

		// Show UI modal for scope violation
		const approval = await UIBlockingHandler.confirmScopeViolation(
			context.session.intentId,
			filePath,
			allowedScopes,
		)

		if (!approval.approved) {
			context.blocked = true
			context.error = {
				type: "SCOPE_VIOLATION",
				message: `Intent ${context.session.intentId} cannot modify ${filePath}`,
				suggestion: `Request scope expansion or use allowed scopes: ${allowedScopes.join(", ")}`,
			}
			context.llmError = AutonomousRecovery.createErrorResponse(
				AutonomousRecovery.scopeViolation(context.session.intentId, filePath, allowedScopes),
			)
		}
	}

	return context
}

// New hook: Check for stale files (optimistic locking)
export const staleFileDetector: PreHook = async (context: HookContext) => {
	if (context.toolName !== "write_to_file") {
		return context
	}

	const filePath = context.args.path
	const snapshotHash = context.session.fileSnapshots?.get(filePath)

	if (!snapshotHash) {
		return context // No snapshot, can't check staleness
	}

	// Calculate current file hash
	const fs = await import("fs/promises")
	const crypto = await import("crypto")

	try {
		const content = await fs.readFile(filePath, "utf-8")
		const currentHash = crypto.createHash("sha256").update(content).digest("hex")

		if (currentHash !== snapshotHash) {
			context.blocked = true
			context.error = {
				type: "STALE_FILE",
				message: `File ${filePath} has been modified by another agent`,
				suggestion: "Re-read the file and merge changes",
			}
			context.llmError = AutonomousRecovery.createErrorResponse(AutonomousRecovery.staleFile(filePath))
		}
	} catch {
		// File doesn't exist, can't be stale
		return context
	}

	return context
}
