// src/hooks/types/commandTypes.ts

export type CommandRisk = "safe" | "destructive" | "unknown"

export interface CommandClassification {
	risk: CommandRisk
	reason?: string
	pattern?: string
	suggestedAlternative?: string
}

export interface ClassifiedCommand {
	original: string
	classification: CommandClassification
	sanitized?: string
}

export const DESTRUCTIVE_PATTERNS = [
	// File system destruction
	{
		pattern: /rm\s+-rf/i,
		risk: "destructive",
		reason: "Force recursive delete",
		alternative: "Use trash or move to backup",
	},
	{ pattern: /rmdir\s+\/s/i, risk: "destructive", reason: "Delete directory recursively", alternative: "Use trash" },
	{ pattern: /format/i, risk: "destructive", reason: "Format disk", alternative: "Never use in development" },
	{ pattern: /mkfs/i, risk: "destructive", reason: "Create file system", alternative: "Never use in development" },
	{ pattern: /dd\s+if=/i, risk: "destructive", reason: "Raw disk write", alternative: "Never use in development" },

	// Git destructive
	{
		pattern: /git\s+push\s+--force/i,
		risk: "destructive",
		reason: "Force push overwrites history",
		alternative: "Use git push --force-with-lease",
	},
	{
		pattern: /git\s+reset\s+--hard/i,
		risk: "destructive",
		reason: "Hard reset loses changes",
		alternative: "Use git reset --soft",
	},
	{
		pattern: /git\s+clean\s+-f/i,
		risk: "destructive",
		reason: "Force clean untracked files",
		alternative: "Dry run with -n first",
	},

	// Database destructive
	{
		pattern: /drop\s+table/i,
		risk: "destructive",
		reason: "Delete entire table",
		alternative: "Use TRUNCATE or backup first",
	},
	{
		pattern: /drop\s+database/i,
		risk: "destructive",
		reason: "Delete entire database",
		alternative: "Never run in production",
	},
	{
		pattern: /delete\s+from\s+\w+\s+where/i,
		risk: "destructive",
		reason: "Delete without WHERE",
		alternative: "Always include WHERE clause",
	},

	// Permission changes
	{
		pattern: /chmod\s+777/i,
		risk: "destructive",
		reason: "World-writable permissions",
		alternative: "Use 755 for directories, 644 for files",
	},
	{
		pattern: /chown/i,
		risk: "destructive",
		reason: "Change ownership",
		alternative: "Use with caution, verify user/group",
	},

	// System commands
	{ pattern: /shutdown/i, risk: "destructive", reason: "Shutdown system", alternative: "Never use in development" },
	{ pattern: /reboot/i, risk: "destructive", reason: "Reboot system", alternative: "Never use in development" },
	{ pattern: /kill\s+-9/i, risk: "destructive", reason: "Force kill process", alternative: "Use kill -15 first" },
]

export const SAFE_PATTERNS = [
	// Read operations
	{ pattern: /ls/i, risk: "safe", reason: "List directory" },
	{ pattern: /cat/i, risk: "safe", reason: "Read file" },
	{ pattern: /head/i, risk: "safe", reason: "Read file start" },
	{ pattern: /tail/i, risk: "safe", reason: "Read file end" },
	{ pattern: /grep/i, risk: "safe", reason: "Search content" },
	{ pattern: /find/i, risk: "safe", reason: "Find files" },
	{ pattern: /which/i, risk: "safe", reason: "Locate command" },

	// Git read
	{ pattern: /git\s+status/i, risk: "safe", reason: "Check status" },
	{ pattern: /git\s+log/i, risk: "safe", reason: "View history" },
	{ pattern: /git\s+diff/i, risk: "safe", reason: "View changes" },
	{ pattern: /git\s+branch/i, risk: "safe", reason: "List branches" },

	// Package managers (install is destructive but common)
	{
		pattern: /npm\s+install/i,
		risk: "destructive",
		reason: "Modifies node_modules",
		alternative: "Use --dry-run first",
	},
	{
		pattern: /pnpm\s+add/i,
		risk: "destructive",
		reason: "Modifies dependencies",
		alternative: "Use --dry-run first",
	},
	{
		pattern: /pip\s+install/i,
		risk: "destructive",
		reason: "Modifies Python packages",
		alternative: "Use in virtualenv",
	},
]
