// src/hooks/trace/astComparator.ts
import * as fs from "fs/promises"

// Use require for tree-sitter to avoid TypeScript issues
const Parser = require("tree-sitter")
const TypeScript = require("tree-sitter-typescript")

export class ASTComparator {
	private static parser: any

	static initialize() {
		if (!this.parser) {
			this.parser = new Parser()
			// Type assertion to avoid TypeScript errors
			this.parser.setLanguage(TypeScript.typescript)
		}
	}

	/**
	 * Compare two code blocks and determine if they are:
	 * - AST_REFACTOR: Same structure, different syntax
	 * - INTENT_EVOLUTION: Different structure (new feature)
	 */
	static async compare(
		original: string,
		modified: string,
	): Promise<{
		classification: "AST_REFACTOR" | "INTENT_EVOLUTION" | "BUG_FIX" | "PERF_IMPROVEMENT" | "DOCS_UPDATE"
		confidence: number
		changes: string[]
	}> {
		try {
			this.initialize()

			// Parse both versions
			const originalTree = this.parser.parse(original)
			const modifiedTree = this.parser.parse(modified)

			// Extract structural fingerprints (ignore identifiers, literals)
			const originalStructure = this.extractStructuralFingerprint(originalTree.rootNode)
			const modifiedStructure = this.extractStructuralFingerprint(modifiedTree.rootNode)

			// Compare structures
			const changes = this.findStructuralChanges(originalStructure, modifiedStructure)

			if (changes.length > 0) {
				// Check if it's a bug fix (TODO/FIXME removal)
				if (
					(original.includes("TODO") && !modified.includes("TODO")) ||
					(original.includes("FIXME") && !modified.includes("FIXME"))
				) {
					return {
						classification: "BUG_FIX",
						confidence: 0.9,
						changes: [...changes, "Fixed TODO/FIXME items"],
					}
				}

				return {
					classification: "INTENT_EVOLUTION",
					confidence: 0.9,
					changes,
				}
			}

			return {
				classification: "AST_REFACTOR",
				confidence: 0.95,
				changes: [],
			}
		} catch (error) {
			console.error("AST comparison failed, falling back to heuristic:", error)
			// Fallback to heuristic
			return this.fallbackCompare(original, modified)
		}
	}

	private static extractStructuralFingerprint(node: any): any {
		if (!node) return null

		// Skip certain node types that don't affect structure
		if (node.type === "identifier" || node.type === "string" || node.type === "number" || node.type === "comment") {
			return null
		}

		const children = []
		if (node.children && node.children.length > 0) {
			for (const child of node.children) {
				const childStruct = this.extractStructuralFingerprint(child)
				if (childStruct) {
					children.push(childStruct)
				}
			}
		}

		return {
			type: node.type,
			children,
		}
	}

	private static findStructuralChanges(original: any, modified: any): string[] {
		const changes: string[] = []

		if (!original && !modified) return changes
		if (!original) {
			changes.push("New structure added")
			return changes
		}
		if (!modified) {
			changes.push("Structure removed")
			return changes
		}

		if (original.type !== modified.type) {
			changes.push(`Node type changed: ${original.type} → ${modified.type}`)
		}

		const originalChildren = original.children || []
		const modifiedChildren = modified.children || []
		const maxLength = Math.max(originalChildren.length, modifiedChildren.length)

		for (let i = 0; i < maxLength; i++) {
			const childChanges = this.findStructuralChanges(originalChildren[i], modifiedChildren[i])
			changes.push(...childChanges)
		}

		return changes
	}

	private static fallbackCompare(original: string, modified: string): any {
		const changes: string[] = []

		// Check for documentation
		if (modified.includes("*") && modified.includes("@")) {
			return {
				classification: "DOCS_UPDATE",
				confidence: 0.8,
				changes: ["Documentation update"],
			}
		}

		const lineDiff = Math.abs(modified.split("\n").length - original.split("\n").length)
		const sizeDiff = Math.abs(modified.length - original.length)

		if (lineDiff > 20 || sizeDiff > 500) {
			changes.push(`Significant change: ${lineDiff} lines, ${sizeDiff} chars`)
			return {
				classification: "INTENT_EVOLUTION",
				confidence: 0.7,
				changes,
			}
		}

		return {
			classification: "AST_REFACTOR",
			confidence: 0.7,
			changes: [],
		}
	}
}
