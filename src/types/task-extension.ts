// src/types/task-extension.ts
/**
 * Extension to the Task type to add intent tracking properties
 * This uses declaration merging to add properties to the existing Task interface
 */

import { Task as OriginalTask } from "../core/task/Task"

declare module "../core/task/Task" {
	interface Task {
		// Current active intent ID for this task
		currentIntentId?: string

		// Current mutation class for tracking
		currentMutationClass?: string

		// File hash snapshots for optimistic locking
		fileSnapshots?: Map<string, string>

		// Model ID for trace recording
		modelId?: string
	}
}

// Also export a helper to safely set these properties
export function setTaskIntent(task: any, intentId: string | undefined, mutationClass?: string) {
	if (task) {
		task.currentIntentId = intentId
		task.currentMutationClass = mutationClass
	}
}

export function getTaskIntent(task: any): { intentId?: string; mutationClass?: string } {
	return {
		intentId: task?.currentIntentId,
		mutationClass: task?.currentMutationClass,
	}
}
