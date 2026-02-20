// src/hooks/recovery/errorHandler.ts
export interface ToolError {
	type: string
	message: string
	suggestion?: string
	details?: any
	recoverable: boolean
}

export class AutonomousRecovery {
	/**
	 * Create standardized error response for LLM
	 */
	static createErrorResponse(error: ToolError): string {
		const response = {
			status: "error",
			error: {
				type: error.type,
				message: error.message,
				recoverable: error.recoverable,
				...(error.suggestion && { suggestion: error.suggestion }),
				...(error.details && { details: error.details }),
			},
			_recovery: error.recoverable
				? {
						instruction: "Please analyze this error and adjust your approach",
						retry: true,
						suggested_actions: this.getSuggestedActions(error.type),
					}
				: {
						instruction: "This error cannot be automatically recovered. Please ask the user for guidance.",
						retry: false,
					},
		}

		return JSON.stringify(response, null, 2)
	}

	/**
	 * Get suggested actions based on error type
	 * Made PUBLIC to be accessible from postHooks
	 */
	static getSuggestedActions(errorType: string): string[] {
		const suggestions: Record<string, string[]> = {
			INTENT_REQUIRED: [
				"Call select_active_intent with a valid intent ID",
				"Check .orchestration/active_intents.yaml for available intents",
			],
			SCOPE_VIOLATION: [
				"Request scope expansion from the user",
				"Use a different intent with broader scope",
				"Focus changes only on allowed directories",
			],
			DESTRUCTIVE_COMMAND: [
				"Use a safer alternative command",
				"Break the operation into smaller steps",
				"Get explicit user approval for the destructive action",
			],
			STALE_FILE: [
				"Re-read the current file content",
				"Merge your changes with the updated version",
				"Restart your operation with fresh file state",
			],
			MISSING_INTENT: [
				"Ensure .orchestration/active_intents.yaml exists",
				"Create a new intent if needed",
				"Use select_active_intent to pick an existing intent",
			],
			FILE_EXCLUDED: [
				"Remove the file from .intentignore",
				"Choose a different file to modify",
				"Request permission from the user",
			],
			COMMAND_EXCLUDED: [
				"Remove the command from .intentignore",
				"Use a different command",
				"Request explicit user approval",
			],
		}

		return (
			suggestions[errorType] || [
				"Analyze the error and adjust your approach",
				"Ask the user for clarification if needed",
				"Break down the task into smaller steps",
			]
		)
	}

	/**
	 * Parse LLM response and extract recovery info
	 */
	static parseRecoveryResponse(response: string): { should_retry: boolean; modified_plan?: string } {
		try {
			const parsed = JSON.parse(response)
			return {
				should_retry: parsed._recovery?.retry || false,
				modified_plan: parsed._recovery?.modified_plan,
			}
		} catch {
			return { should_retry: false }
		}
	}

	/**
	 * Create scope violation error
	 */
	static scopeViolation(intentId: string, filePath: string, allowedScopes: string[]): ToolError {
		return {
			type: "SCOPE_VIOLATION",
			message: `Intent ${intentId} cannot modify ${filePath}`,
			suggestion: `Allowed scopes: ${allowedScopes.join(", ")}`,
			details: { intentId, filePath, allowedScopes },
			recoverable: true,
		}
	}

	/**
	 * Create intent required error
	 */
	static intentRequired(): ToolError {
		return {
			type: "INTENT_REQUIRED",
			message: "You must select an active intent before making changes",
			suggestion: "Use select_active_intent tool with a valid intent ID",
			recoverable: true,
		}
	}

	/**
	 * Create destructive command error
	 */
	static destructiveCommand(command: string, alternative?: string): ToolError {
		return {
			type: "DESTRUCTIVE_COMMAND",
			message: `Destructive command blocked: ${command}`,
			suggestion: alternative || "Request explicit user approval or use safer alternative",
			details: { command },
			recoverable: true,
		}
	}

	/**
	 * Create stale file error
	 */
	static staleFile(filePath: string): ToolError {
		return {
			type: "STALE_FILE",
			message: `File ${filePath} has been modified by another agent`,
			suggestion: "Re-read the file and merge changes",
			details: { filePath },
			recoverable: true,
		}
	}

	/**
	 * Create file excluded error
	 */
	static fileExcluded(filePath: string): ToolError {
		return {
			type: "FILE_EXCLUDED",
			message: `File ${filePath} is excluded by .intentignore`,
			suggestion: "Remove from .intentignore or choose different file",
			details: { filePath },
			recoverable: true,
		}
	}

	/**
	 * Create command excluded error
	 */
	static commandExcluded(command: string): ToolError {
		return {
			type: "COMMAND_EXCLUDED",
			message: `Command excluded by .intentignore`,
			details: { command },
			recoverable: true,
		}
	}
}
