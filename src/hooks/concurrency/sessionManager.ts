// src/hooks/concurrency/sessionManager.ts
import { EventEmitter } from "events"
import { OptimisticLockManager } from "./optimisticLock"
import { LessonRecorder } from "../learning/lessonRecorder"

export interface AgentSession {
	id: string
	type: "architect" | "builder" | "tester" | "reviewer"
	startTime: Date
	lastActive: Date
	intentId?: string
	status: "active" | "idle" | "blocked" | "completed"
	filesRead: Set<string>
	filesWritten: Set<string>
	currentFile?: string
	metrics: {
		tokensUsed: number
		actionsTaken: number
		errors: number
	}
}

export class ParallelSessionManager extends EventEmitter {
	private static instance: ParallelSessionManager
	private sessions: Map<string, AgentSession> = new Map()
	private lockManager: OptimisticLockManager
	private lessonRecorder: LessonRecorder
	private maxConcurrentAgents: number = 5

	private constructor(workspaceRoot: string) {
		super()
		this.lockManager = OptimisticLockManager.getInstance()
		this.lessonRecorder = new LessonRecorder(workspaceRoot)
		this.startHealthCheck()
	}

	static getInstance(workspaceRoot: string): ParallelSessionManager {
		if (!ParallelSessionManager.instance) {
			ParallelSessionManager.instance = new ParallelSessionManager(workspaceRoot)
		}
		return ParallelSessionManager.instance
	}

	/**
	 * Register a new agent session
	 */
	registerSession(agentId: string, type: AgentSession["type"]): AgentSession {
		const session: AgentSession = {
			id: agentId,
			type,
			startTime: new Date(),
			lastActive: new Date(),
			status: "active",
			filesRead: new Set(),
			filesWritten: new Set(),
			metrics: {
				tokensUsed: 0,
				actionsTaken: 0,
				errors: 0,
			},
		}

		this.sessions.set(agentId, session)
		this.emit("sessionStarted", { agentId, type })

		return session
	}

	/**
	 * Update session activity
	 */
	updateSession(agentId: string, updates: Partial<AgentSession>): void {
		const session = this.sessions.get(agentId)
		if (session) {
			Object.assign(session, updates)
			session.lastActive = new Date()
			this.sessions.set(agentId, session)
		}
	}

	/**
	 * Get active sessions
	 */
	getActiveSessions(): AgentSession[] {
		const now = new Date()
		return Array.from(this.sessions.values()).filter((s) => now.getTime() - s.lastActive.getTime() < 60000) // Active in last minute
	}

	/**
	 * Check if we can start a new agent
	 */
	canStartNewAgent(): boolean {
		return this.getActiveSessions().length < this.maxConcurrentAgents
	}

	/**
	 * Get session status report
	 */
	getStatusReport(): string {
		const active = this.getActiveSessions()
		const report: string[] = []

		report.push("# Parallel Agent Sessions\n")
		report.push(`**Active Agents:** ${active.length}/${this.maxConcurrentAgents}\n`)

		if (active.length === 0) {
			report.push("No active sessions.\n")
		} else {
			report.push("## Active Sessions\n")

			active.forEach((session) => {
				report.push(`### ${session.type.toUpperCase()}: ${session.id}`)
				report.push(`- **Status:** ${session.status}`)
				report.push(`- **Intent:** ${session.intentId || "none"}`)
				report.push(`- **Files Read:** ${session.filesRead.size}`)
				report.push(`- **Files Written:** ${session.filesWritten.size}`)
				report.push(`- **Actions:** ${session.metrics.actionsTaken}`)
				report.push(`- **Errors:** ${session.metrics.errors}`)
				report.push("")
			})
		}

		// Add lock status
		const lockStatus = this.lockManager.getLockStatus()
		if (lockStatus.activeLocks.length > 0) {
			report.push("## File Locks\n")
			lockStatus.activeLocks.forEach((lock: any) => {
				report.push(`- ${lock.file} (locked by ${lock.agentId} for ${Math.round(lock.age / 1000)}s)`)
			})
		}

		return report.join("\n")
	}

	/**
	 * Coordinate between architect and builder
	 */
	async architectBuilderHandoff(
		architectId: string,
		builderId: string,
		intentId: string,
		plan: string,
	): Promise<void> {
		const architect = this.sessions.get(architectId)
		const builder = this.sessions.get(builderId)

		if (!architect || !builder) {
			throw new Error("Sessions not found")
		}

		// Record the handoff
		await this.lessonRecorder.recordLesson({
			type: "insight",
			intentId,
			message: `Architect → Builder handoff for ${intentId}`,
			details: { plan, architectId, builderId },
			tags: ["handoff", "orchestration"],
		})

		// Update sessions
		this.updateSession(architectId, { status: "completed" })
		this.updateSession(builderId, { intentId, status: "active" })

		this.emit("handoff", { architectId, builderId, intentId })
	}

	/**
	 * Detect and resolve conflicts
	 */
	async detectConflicts(): Promise<Array<{ file: string; agents: string[] }>> {
		const conflicts: Array<{ file: string; agents: string[] }> = []
		const fileAccess: Map<string, Set<string>> = new Map()

		// Group by file
		for (const [agentId, session] of this.sessions) {
			for (const file of session.filesWritten) {
				if (!fileAccess.has(file)) {
					fileAccess.set(file, new Set())
				}
				fileAccess.get(file)!.add(agentId)
			}
		}

		// Find conflicts (files written by multiple agents)
		for (const [file, agents] of fileAccess) {
			if (agents.size > 1) {
				conflicts.push({
					file,
					agents: Array.from(agents),
				})
			}
		}

		return conflicts
	}

	/**
	 * Health check to clean up stale sessions
	 */
	private startHealthCheck(): void {
		setInterval(() => {
			const now = new Date()
			const staleThreshold = 5 * 60 * 1000 // 5 minutes

			for (const [agentId, session] of this.sessions) {
				if (now.getTime() - session.lastActive.getTime() > staleThreshold) {
					console.log(`🧹 Cleaning up stale session: ${agentId}`)
					this.sessions.delete(agentId)
					this.emit("sessionExpired", { agentId })
				}
			}
		}, 60000) // Check every minute
	}
}
