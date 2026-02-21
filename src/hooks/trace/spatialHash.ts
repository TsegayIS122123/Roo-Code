// src/hooks/trace/spatialHash.ts
import { createHash } from "crypto"
import * as fs from "fs/promises"
import * as path from "path"
import { ASTComparator } from "./astComparator"

export class SpatialHash {
	/**
	 * Generate SHA-256 hash of content
	 * Core hashing function for spatial independence
	 */
	static hashContent(content: string): string {
		return createHash("sha256")
			.update(content || "")
			.digest("hex")
	}

	/**
	 * Normalize content before hashing (remove whitespace variations)
	 * This makes hash resistant to formatting changes
	 */
	static normalizeAndHash(content: string): string {
		// Remove trailing whitespace and normalize line endings
		const normalized = content
			.split("\n")
			.map((line) => line.trimEnd())
			.join("\n")
			.trim()

		return this.hashContent(normalized)
	}

	/**
	 * Generate hash for a specific code block by line numbers
	 */
	static async hashCodeBlock(filePath: string, startLine: number, endLine: number): Promise<string | null> {
		try {
			const content = await fs.readFile(filePath, "utf-8")
			const lines = content.split("\n")

			if (startLine < 1 || endLine > lines.length) {
				return null
			}

			const block = lines.slice(startLine - 1, endLine).join("\n")
			return this.normalizeAndHash(block)
		} catch {
			return null
		}
	}

	/**
	 * Find code blocks by hash (spatial independence)
	 * This allows tracing code even after it moves
	 */
	static async findByHash(
		hash: string,
		searchPaths: string[] = ["src"],
	): Promise<Array<{ file: string; startLine: number; endLine: number; content: string }>> {
		const results: Array<{ file: string; startLine: number; endLine: number; content: string }> = []

		for (const searchPath of searchPaths) {
			await this.searchDirectory(searchPath, hash, results)
		}

		return results
	}

	/**
	 * Recursively search directory for matching hash
	 */
	private static async searchDirectory(dirPath: string, targetHash: string, results: any[]): Promise<void> {
		try {
			const entries = await fs.readdir(dirPath, { withFileTypes: true })

			for (const entry of entries) {
				const fullPath = path.join(dirPath, entry.name)

				if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
					await this.searchDirectory(fullPath, targetHash, results)
				} else if (entry.isFile() && /\.(ts|js|tsx|jsx)$/.test(entry.name)) {
					await this.searchFile(fullPath, targetHash, results)
				}
			}
		} catch {
			// Ignore permission errors
		}
	}

	/**
	 * Search single file for matching hash using sliding window
	 */
	private static async searchFile(filePath: string, targetHash: string, results: any[]): Promise<void> {
		try {
			const content = await fs.readFile(filePath, "utf-8")
			const lines = content.split("\n")

			// Slide window of increasing sizes (5-50 lines)
			for (let windowSize = 5; windowSize <= 50; windowSize += 5) {
				for (let i = 0; i <= lines.length - windowSize; i++) {
					const block = lines.slice(i, i + windowSize).join("\n")
					const hash = this.normalizeAndHash(block)

					if (hash === targetHash) {
						results.push({
							file: filePath,
							startLine: i + 1,
							endLine: i + windowSize,
							content: block,
						})
						break // Found in this window, move to next position
					}
				}
			}
		} catch {
			// Ignore read errors
		}
	}

	/**
	 * Classify mutation type using content heuristics (no AST required)
	 */
	// Add this import at the top

	// Replace the classifyMutation method with:
	static async classifyMutation(
		originalContent: string,
		newContent: string,
	): Promise<{
		class: "AST_REFACTOR" | "INTENT_EVOLUTION" | "BUG_FIX" | "PERF_IMPROVEMENT" | "DOCS_UPDATE"
		confidence: number
		changes: string[]
	}> {
		// Try AST comparison first for accurate structural analysis
		try {
			const result = await ASTComparator.compare(originalContent, newContent)
			return {
				class: result.classification,
				confidence: result.confidence,
				changes: result.changes,
			}
		} catch (error) {
			console.warn("AST comparison failed, using heuristic fallback:", error)
			return this.fallbackClassification(originalContent, newContent)
		}
	}

	// Keep your existing fallbackClassification method
	static fallbackClassification(
		originalContent: string,
		newContent: string,
	): {
		class: "AST_REFACTOR" | "INTENT_EVOLUTION" | "BUG_FIX" | "PERF_IMPROVEMENT" | "DOCS_UPDATE"
		confidence: number
		changes: string[]
	} {
		const changes = []
		let confidence = 0.7

		// Check if it's documentation
		if (
			(newContent.includes("*") && newContent.includes("@param")) ||
			newContent.includes("@returns") ||
			newContent.includes("@throws")
		) {
			return {
				class: "DOCS_UPDATE",
				confidence: 0.9,
				changes: ["Documentation update"],
			}
		}

		// Calculate size differences
		const originalLines = originalContent.split("\n").length
		const newLines = newContent.split("\n").length
		const originalSize = originalContent.length
		const newSize = newContent.length

		const lineDiff = Math.abs(newLines - originalLines)
		const sizeDiff = Math.abs(newSize - originalSize)

		// Check for bug fixes (TODO/FIXME removal)
		if (originalContent.includes("TODO") && !newContent.includes("TODO")) {
			changes.push("Removed TODO comment")
			confidence = 0.8
		}
		if (originalContent.includes("FIXME") && !newContent.includes("FIXME")) {
			changes.push("Removed FIXME comment")
			confidence = 0.8
		}

		// Check for performance improvements
		if (originalContent.includes("forEach") && newContent.includes("for(")) {
			changes.push("Replaced forEach with for loop")
			confidence = 0.85
		}

		// Significant changes indicate evolution
		if (lineDiff > 20 || sizeDiff > 500) {
			changes.push(`Significant change: ${lineDiff} lines, ${sizeDiff} chars`)
			return {
				class: "INTENT_EVOLUTION",
				confidence: 0.85,
				changes,
			}
		}

		// If we have specific change indicators, use them
		if (changes.length > 0) {
			return {
				class: changes.includes("Removed TODO") ? "BUG_FIX" : "AST_REFACTOR",
				confidence,
				changes,
			}
		}

		// Default to refactor for small changes
		return {
			class: "AST_REFACTOR",
			confidence: 0.6,
			changes: ["Minor adjustments"],
		}
	}
}
