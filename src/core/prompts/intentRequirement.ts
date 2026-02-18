// src/core/prompts/intentRequirement.ts
/**
 * INTENT-DRIVEN DEVELOPMENT REQUIREMENT
 * This is injected into the system prompt to enforce the handshake protocol
 * The agent MUST call select_active_intent before any code changes
 */

export const INTENT_REQUIREMENT = `
==== CRITICAL: INTENT-DRIVEN DEVELOPMENT PROTOCOL ====
You are operating in a GOVERNED AI-NATIVE IDE environment.

╔════════════════════════════════════════════════════════════╗
║                    MANDATORY RULES                         ║
╠════════════════════════════════════════════════════════════╣
║ 1. You CANNOT write code or execute commands immediately  ║
║ 2. Your FIRST action MUST be to select an active intent   ║
║ 3. You MUST call select_active_intent(intent_id) first    ║
║ 4. Without a selected intent, ALL actions will be BLOCKED ║
║ 5. The intent_id must exist in active_intents.yaml        ║
╚════════════════════════════════════════════════════════════╝

Consequences of violation:
- File writes will be rejected with "INTENT_REQUIRED" error
- Command execution will be rejected with "INTENT_REQUIRED" error
- The session will be paused until a valid intent is selected

This is NOT optional - it is ENFORCED by the Hook Engine.
==========================================================
`

/**
 * Returns the intent requirement block for system prompt injection
 * This makes the enforcement EXPLICIT and VISIBLE in code
 */
export function getIntentRequirement(): string {
	return INTENT_REQUIREMENT
}
