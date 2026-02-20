// src/hooks/integration.ts
/**
 * HOOK INTEGRATION POINT - Phase 2 Complete
 */

import { hookRegistry } from "./index"
import { intentGatekeeper, commandClassifier, scopeEnforcer, staleFileDetector } from "./preHooks"
import { traceRecorder, lessonRecorder, recoveryLogger } from "./postHooks"
import { IntentIgnoreManager } from "./utils/intentIgnore"

/**
 * Initialize all hooks for Phase 2
 */
export async function initializeHooks() {
	console.log("🔌 Initializing Hook Engine - Phase 2...")

	// Load .intentignore rules
	const ignoreManager = await IntentIgnoreManager.getInstance()
	console.log(`📋 Loaded ${ignoreManager.getRules().length} .intentignore rules`)

	// ===== PRE-HOOKS (Validation Layer) =====

	// Security Layer - Always runs first
	hookRegistry.registerPreTool("execute_command", commandClassifier)
	hookRegistry.registerPreTool("execute_command", intentGatekeeper)

	// File Operations Layer
	hookRegistry.registerPreTool("write_to_file", intentGatekeeper)
	hookRegistry.registerPreTool("write_to_file", scopeEnforcer)
	hookRegistry.registerPreTool("write_to_file", staleFileDetector)

	// Apply to other tools
	hookRegistry.registerPreTool("apply_diff", intentGatekeeper)
	hookRegistry.registerPreTool("apply_diff", staleFileDetector)
	hookRegistry.registerPreTool("search_and_replace", intentGatekeeper)

	// ===== POST-HOOKS (Recording Layer) =====

	// Trace Recording
	hookRegistry.registerPostTool("write_to_file", traceRecorder)
	hookRegistry.registerPostTool("apply_diff", traceRecorder)

	// Learning & Recovery
	hookRegistry.registerGlobalPost(lessonRecorder)
	hookRegistry.registerGlobalPost(recoveryLogger)

	console.log("✅ Phase 2 Hook Engine initialized:")
	console.log("   • Command Classification: Active")
	console.log("   • UI-Blocking Modals: Active")
	console.log("   • .intentignore Support: Active")
	console.log("   • Scope Enforcement: Active")
	console.log("   • Autonomous Recovery: Active")
}

/**
 * Example .intentignore file content
 */
export const INTENTIGNORE_EXAMPLE = `# .intentignore - Intent-based exclusion rules
# Format: [intent_id:]pattern [type] [# comment]

# Global exclusions (apply to all intents)
node_modules/**        # Dependencies - never modify
.git/**                # Git internals - never modify
dist/**                # Build output - exclude
*.log                  # Log files - exclude

# Intent-specific rules
INT-001:src/core/** allow_destructive  # Core team can run destructive commands
INT-002:src/api/** require_approval    # API changes require extra approval
INT-003:*.md          exclude           # Documentation - read-only
`

/**
 * Autonomous Recovery Flow
 */
export const recoveryFlowExample = `
When an error occurs:
1. Hook blocks execution
2. AutonomousRecovery creates standardized error
3. Error sent to LLM with suggestions
4. LLM self-corrects and retries
5. Recovery logged to CLAUDE.md
`
