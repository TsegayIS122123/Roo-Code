// src/hooks/integration-phase34.ts
import { TraceRecorder } from "./trace/traceRecorder"
import { SpatialHash } from "./trace/spatialHash"
import { TraceQuery } from "./trace/traceQuery"
import { OptimisticLockManager } from "./concurrency/optimisticLock"
import { LessonRecorder } from "./learning/lessonRecorder"
import { ParallelSessionManager } from "./concurrency/sessionManager"
import { hookRegistry } from "./index"
import { enhancedTraceRecorder, initializeTraceRecorder } from "./postHooks"
import { staleFileDetector } from "./preHooks"

export async function initializePhases34(workspaceRoot: string) {
	console.log("🚀 Initializing Phases 3 & 4...")

	// Phase 3: Trace Layer
	console.log("📊 Phase 3: AI-Native Git Layer")
	initializeTraceRecorder(workspaceRoot)

	// Register enhanced trace recorder
	hookRegistry.registerPostTool("write_to_file", enhancedTraceRecorder)

	// Phase 4: Concurrency Control
	console.log("🔄 Phase 4: Parallel Orchestration")
	const lockManager = OptimisticLockManager.getInstance()
	const sessionManager = ParallelSessionManager.getInstance(workspaceRoot)
	const lessonRecorder = new LessonRecorder(workspaceRoot)

	// Register stale file detection
	hookRegistry.registerPreTool("write_to_file", staleFileDetector)

	console.log("✅ Phases 3 & 4 initialized:")
	console.log("   • Trace Recording: Active (SHA-256 hashing)")
	console.log("   • Mutation Classification: Active")
	console.log("   • Spatial Independence: Active")
	console.log("   • Optimistic Locking: Active")
	console.log("   • Lesson Learning: Active")
	console.log("   • Session Management: Active")
}

// Example usage of trace query
export async function demonstrateTraceability(workspaceRoot: string, intentId: string) {
	const traceQuery = new TraceQuery(workspaceRoot)

	// Get intent history
	const history = await traceQuery.getIntentHistory(intentId)
	console.log(`Intent ${intentId}: ${history.changeCount} changes across ${history.files.size} files`)

	// Generate impact report
	const report = await traceQuery.generateImpactReport(intentId)
	console.log(report)

	return history
}

// Example of parallel session coordination
export async function demonstrateParallelCoordination(
	workspaceRoot: string,
	architectId: string,
	builderId: string,
	intentId: string,
) {
	const sessionManager = ParallelSessionManager.getInstance(workspaceRoot)

	// Register sessions
	sessionManager.registerSession(architectId, "architect")
	sessionManager.registerSession(builderId, "builder")

	// Hand off from architect to builder
	await sessionManager.architectBuilderHandoff(
		architectId,
		builderId,
		intentId,
		"Implementation plan for Weather API",
	)

	// Check for conflicts
	const conflicts = await sessionManager.detectConflicts()
	if (conflicts.length > 0) {
		console.warn("⚠️ Potential conflicts detected:", conflicts)
	}

	// Get status
	console.log(sessionManager.getStatusReport())
}
