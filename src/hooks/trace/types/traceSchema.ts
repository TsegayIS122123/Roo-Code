// src/hooks/trace/types/traceSchema.ts

/**
 * Agent Trace Specification - Complete Implementation
 * Based on Cursor's Agent Trace spec with extensions
 */

export type ContributorType = "Human" | "AI" | "Mixed" | "Unknown"
export type MutationClass = "AST_REFACTOR" | "INTENT_EVOLUTION" | "BUG_FIX" | "PERF_IMPROVEMENT" | "DOCS_UPDATE"

export interface Contributor {
	entity_type: ContributorType
	model_identifier?: string // e.g., 'claude-3-5-sonnet-20241022'
	user_id?: string // For human contributors
	session_id?: string // For tracking conversation sessions
}

export interface CodeRange {
	start_line: number // 1-indexed start line
	end_line: number // 1-indexed end line
	content_hash: string // SHA-256 hash for spatial independence
	ast_node_type?: string // Optional: function, class, etc.
	ast_node_name?: string // Optional: function name, class name
}

export interface ConversationRef {
	url: string // Link to conversation/chat log
	timestamp: string // When this conversation occurred
	summary?: string // Optional summary of the conversation
}

export interface RelatedResource {
	type: "specification" | "issue" | "pr" | "discussion" | "design_doc" | "content_hash"
	value: string // e.g., 'INT-001', 'GH-123', 'sha256:abc...'
	url?: string // Optional link to resource
}

export interface FileTrace {
	relative_path: string // Path relative to repo root
	absolute_path?: string // Optional absolute path for local debugging
	conversations: Array<{
		conversation: ConversationRef
		contributor: Contributor
		ranges: CodeRange[]
		related: RelatedResource[]
		mutation_class?: MutationClass // What kind of change
		confidence?: number // 0-1, confidence in attribution
	}>
}

export interface TraceRecord {
	id: string // UUID v4
	timestamp: string // RFC 3339 (ISO 8601)
	vcs: {
		revision_id: string // Git commit SHA
		branch?: string // Current branch
		repository?: string // Repository URL/name
		is_dirty?: boolean // Whether working tree has uncommitted changes
	}
	files: FileTrace[]
	metadata?: {
		workspace?: string // VS Code workspace name
		extension_version?: string // Roo Code extension version
		session_id?: string // Unique session identifier
		tags?: string[] // Custom tags for filtering
	}
}

export interface TraceQuery {
	intent_id?: string
	file_path?: string
	time_range?: { start: string; end: string }
	contributor_type?: ContributorType
	mutation_class?: MutationClass
}
