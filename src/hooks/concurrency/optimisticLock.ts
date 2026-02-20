// src/hooks/concurrency/optimisticLock.ts
import * as fs from "fs/promises"
import { createHash } from "crypto"
import { EventEmitter } from "events"

export interface FileVersion {
	path: string
	hash: string
	timestamp: number
	agentId: string
	intentId: string
}

export class OptimisticLockManager extends EventEmitter {
	private static instance: OptimisticLockManager
	private fileVersions: Map<string, FileVersion> = new Map()
	private activeLocks: Map<string, { agentId: string; acquired: number }> = new Map()
	private waitingWrites: Map<
		string,
		Array<{
			agentId: string
			resolve: () => void
			reject: (reason?: any) => void
		}>
	> = new Map()

	private constructor() {
		super()
		this.startCleanupInterval()
	}

	static getInstance(): OptimisticLockManager {
		if (!OptimisticLockManager.instance) {
			OptimisticLockManager.instance = new OptimisticLockManager()
		}
		return OptimisticLockManager.instance
	}

	/**
	 * Acquire a lock on a file before reading
	 */
	async acquireLock(filePath: string, agentId: string): Promise<boolean> {
		const normalizedPath = this.normalizePath(filePath)

		// Check if file is already locked
		if (this.activeLocks.has(normalizedPath)) {
			const lock = this.activeLocks.get(normalizedPath)!

			// If lock is older than 30 seconds, consider it stale
			if (Date.now() - lock.acquired > 30000) {
				console.warn(`⚠️ Stale lock detected on ${filePath}, releasing`)
				this.releaseLock(filePath, lock.agentId)
			} else {
				// Queue this agent for retry
				return false
			}
		}

		// Acquire lock
		this.activeLocks.set(normalizedPath, {
			agentId,
			acquired: Date.now(),
		})

		this.emit("lockAcquired", { filePath, agentId })
		return true
	}

	/**
	 * Release a lock after operation completes
	 */
	async releaseLock(filePath: string, agentId: string): Promise<void> {
		const normalizedPath = this.normalizePath(filePath)
		const lock = this.activeLocks.get(normalizedPath)

		if (lock && lock.agentId === agentId) {
			this.activeLocks.delete(normalizedPath)
			this.emit("lockReleased", { filePath, agentId })

			// Process any waiting writes
			await this.processWaitingQueue(normalizedPath)
		}
	}

	/**
	 * Register a file version after reading
	 */
	async registerReadVersion(filePath: string, agentId: string, intentId: string): Promise<FileVersion> {
		const normalizedPath = this.normalizePath(filePath)
		let content: string

		try {
			content = await fs.readFile(filePath, "utf-8")
		} catch {
			// File doesn't exist yet
			content = ""
		}

		const hash = createHash("sha256").update(content).digest("hex")

		const version: FileVersion = {
			path: normalizedPath,
			hash,
			timestamp: Date.now(),
			agentId,
			intentId,
		}

		this.fileVersions.set(`${normalizedPath}:${agentId}`, version)
		return version
	}

	/**
	 * Validate write operation (optimistic locking)
	 */
	async validateWrite(
		filePath: string,
		agentId: string,
		content: string,
	): Promise<{ valid: boolean; error?: string; currentHash?: string }> {
		const normalizedPath = this.normalizePath(filePath)

		// Get the version this agent read
		const versionKey = `${normalizedPath}:${agentId}`
		const readVersion = this.fileVersions.get(versionKey)

		if (!readVersion) {
			return {
				valid: false,
				error: "No read version recorded. Must read file before writing.",
			}
		}

		// Get current file hash
		let currentHash: string
		try {
			const currentContent = await fs.readFile(filePath, "utf-8")
			currentHash = createHash("sha256").update(currentContent).digest("hex")
		} catch {
			// File doesn't exist
			currentHash = ""
		}

		// Compare with read version
		if (currentHash !== readVersion.hash) {
			return {
				valid: false,
				error: "STALE_FILE: File has been modified by another agent",
				currentHash,
			}
		}

		return { valid: true }
	}

	/**
	 * Queue a write when file is locked
	 */
	async queueWrite(
		filePath: string,
		agentId: string,
		content: string,
		intentId: string,
	): Promise<{ queued: boolean; position?: number }> {
		const normalizedPath = this.normalizePath(filePath)

		if (!this.waitingWrites.has(normalizedPath)) {
			this.waitingWrites.set(normalizedPath, [])
		}

		// Return a promise that resolves when it's this agent's turn
		return new Promise<{ queued: boolean; position?: number }>((resolve, reject) => {
			const queue = this.waitingWrites.get(normalizedPath)!
			const position = queue.length

			// Store the resolve and reject functions to call later
			queue.push({
				agentId,
				resolve: () => {
					// When resolved, return the queued status with position
					resolve({ queued: true, position })
				},
				reject,
			})

			this.emit("writeQueued", { filePath, agentId, position })

			// If this is the first in queue, they might get processed immediately
			if (position === 0) {
				// Try to process immediately
				this.processWaitingQueue(normalizedPath).catch(console.error)
			}
		})
	}

	/**
	 * Process waiting queue after lock release
	 */
	private async processWaitingQueue(filePath: string): Promise<void> {
		const queue = this.waitingWrites.get(filePath)
		if (!queue || queue.length === 0) return

		// Notify the first waiting agent
		const next = queue.shift()
		if (next) {
			// Call resolve which will return { queued: true, position: 0 }
			next.resolve()
		}

		if (queue.length === 0) {
			this.waitingWrites.delete(filePath)
		}
	}

	/**
	 * Normalize file path
	 */
	private normalizePath(filePath: string): string {
		return filePath.replace(/\\/g, "/").toLowerCase()
	}

	/**
	 * Start cleanup interval for stale locks
	 */
	private startCleanupInterval(): void {
		setInterval(() => {
			const now = Date.now()

			for (const [filePath, lock] of this.activeLocks.entries()) {
				if (now - lock.acquired > 60000) {
					// 1 minute timeout
					console.warn(`⚠️ Force releasing stale lock on ${filePath} from agent ${lock.agentId}`)
					this.activeLocks.delete(filePath)
					this.processWaitingQueue(filePath).catch(console.error)
				}
			}
		}, 30000) // Check every 30 seconds
	}

	/**
	 * Get lock status for UI
	 */
	getLockStatus(): any {
		return {
			activeLocks: Array.from(this.activeLocks.entries()).map(([path, lock]) => ({
				file: path,
				agentId: lock.agentId,
				age: Date.now() - lock.acquired,
			})),
			waitingWrites: Array.from(this.waitingWrites.entries()).map(([path, queue]) => ({
				file: path,
				queueLength: queue.length,
			})),
		}
	}
}
