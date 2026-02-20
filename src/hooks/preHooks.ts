// src/hooks/preHooks.ts
import { HookContext, PreHook, PostHook, ToolResult } from "./index"
import { CommandClassifier } from "./security/commandClassifier"
import { UIBlockingHandler } from "./security/uiBlocking"
import { IntentIgnoreManager } from "./utils/intentIgnore"
import { AutonomousRecovery } from "./recovery/errorHandler"
import { validateIntentScope } from "./utils/intentLoader"
import { OptimisticLockManager } from "./concurrency/optimisticLock"

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

// New hook: Check for stale files (optimistic locking) - ONLY ONCE
export const staleFileDetector: PreHook = async (context: HookContext) => {
	if (context.toolName !== "write_to_file") {
		return context
	}

	const filePath = context.args.path
	const agentId = context.session.conversationId
	const intentId = context.session.intentId

	if (!intentId) {
		return context // Let intent gatekeeper handle this
	}

	const lockManager = OptimisticLockManager.getInstance()

	// Try to acquire lock
	const lockAcquired = await lockManager.acquireLock(filePath, agentId)

	if (!lockAcquired) {
		// Queue this write
		const queueResult = await lockManager.queueWrite(filePath, agentId, context.args.content, intentId)

		context.blocked = true
		context.error = {
			type: "FILE_LOCKED",
			message: `File ${filePath} is currently being modified by another agent`,
			suggestion: `Your write has been queued (position ${queueResult.position}). Please wait.`,
		}
		return context
	}

	// Validate write against read version
	const validation = await lockManager.validateWrite(filePath, agentId, context.args.content)

	if (!validation.valid) {
		context.blocked = true
		context.error = {
			type: "STALE_FILE",
			message: validation.error || "File has been modified by another agent",
			suggestion: "Re-read the file and merge your changes",
		}

		// Release lock since we're not writing
		await lockManager.releaseLock(filePath, agentId)
	}

	return context
}

// Note: The lockReleaser post-hook should be in postHooks.ts, not here

// Release lock after successful write (add to post-hooks)
export const lockReleaser: PostHook = async (context: HookContext, result: ToolResult) => {
	if (context.toolName !== "write_to_file") {
		return
	}

	const filePath = context.args.path
	const agentId = context.session.conversationId

	const lockManager = OptimisticLockManager.getInstance()
	await lockManager.releaseLock(filePath, agentId)
}
