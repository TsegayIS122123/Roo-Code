# Phase 1: The Handshake - Complete Implementation

## 📋 Overview

This document describes the complete implementation of the Intent Handshake protocol, solving the Context Paradox by bridging synchronous LLM reasoning with asynchronous IDE operations.

## 🎯 Goal Achieved

The agent **MUST** select an intent before any code changes. The system injects full context (constraints, scope, and recent history) into the LLM's context window.

---

## 🔧 Implementation Components

| Component             | File                                       | Responsibility                         |
| --------------------- | ------------------------------------------ | -------------------------------------- |
| **Tool Definition**   | `src/core/tools/SelectActiveIntentTool.ts` | Defines the intent selection tool      |
| **Intent Loader**     | `src/hooks/utils/intentLoader.ts`          | Parses YAML and loads trace history    |
| **Context Generator** | `getEnhancedIntentContext()`               | Creates XML with intent + history      |
| **Trace Loader**      | `getRecentTracesForIntent()`               | Fetches related trace entries          |
| **Gatekeeper**        | `src/hooks/preHooks.ts:intentGatekeeper`   | Validates intent before tool execution |
| **System Prompt**     | `src/core/prompts/intentRequirement.ts`    | Enforces intent-first protocol         |

---

## 🔄 Complete Handshake Flow

┌─────────────────────────────────────────────────────────────────┐
│ COMPLETE HANDSHAKE FLOW │
├─────────────────────────────────────────────────────────────────┤
│ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ STEP 1: User Request │ │
│ │ "Build Weather API endpoint" │ │
│ └─────────────────────────────────────────────────────────┘ │
│ │ │
│ ▼ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ STEP 2: System Prompt (with MANDATORY rule) │ │
│ │ "You MUST call select_active_intent first" │ │
│ │ File: src/core/prompts/intentRequirement.ts │ │
│ └─────────────────────────────────────────────────────────┘ │
│ │ │
│ ▼ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ STEP 3: Agent calls select_active_intent("INT-001") │ │
│ │ File: src/core/tools/SelectActiveIntentTool.ts │ │
│ └─────────────────────────────────────────────────────────┘ │
│ │ │
│ ▼ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ STEP 4: Context Loader │ │
│ │ ├── Reads .orchestration/active_intents.yaml │ │
│ │ ├── Finds INT-001 configuration │ │
│ │ └── Loads recent trace entries from agent_trace.jsonl │ │
│ │ File: src/hooks/utils/intentLoader.ts │ │
│ └─────────────────────────────────────────────────────────┘ │
│ │ │
│ ▼ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ STEP 5: XML Context Generation │ │
│ │ Function: getEnhancedIntentContext() │ │
│ │ Output: Complete XML with constraints + traces │ │
│ └─────────────────────────────────────────────────────────┘ │
│ │ │
│ ▼ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ STEP 6: Tool Returns Context │ │
│ │ {
│ │ "status": "success",
│ │ "context": "<xml_context>",
│ │ "trace_count": 3,
│ │ "timestamp": "2026-02-19T..."
│ │ }
│ └─────────────────────────────────────────────────────────┘ │
│ │ │
│ ▼ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ STEP 7: Context Injected into Next LLM Prompt │ │
│ │ Agent now has full context about the intent │ │
│ └─────────────────────────────────────────────────────────┘ │
│ │ │
│ ▼ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ STEP 8: Tool Call (write_to_file) with intent in session│ │
│ │ Session now has intentId = "INT-001" │ │
│ └─────────────────────────────────────────────────────────┘ │
│ │ │
│ ▼ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ STEP 9: Pre-Hook Gatekeeper │ │
│ │ File: src/hooks/preHooks.ts:intentGatekeeper │ │
│ │ └── Validates: session.intentId = "INT-001" ✓ │ │
│ └─────────────────────────────────────────────────────────┘ │
│ │ │
│ ▼ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ STEP 10: Tool Executes │ │
│ └─────────────────────────────────────────────────────────┘ │
│ │ │
│ ▼ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ STEP 11: Post-Hook Records Trace │ │
│ │ File: src/hooks/postHooks.ts:traceRecorder │ │
│ │ └── Links code → INT-001 in agent_trace.jsonl │ │
│ └─────────────────────────────────────────────────────────┘ │
│ │
└─────────────────────────────────────────────────────────────────┘

text

---

## 📦 Data Formats

### 1. Intent Selection Request

```json
{
	"tool": "select_active_intent",
	"params": {
		"intent_id": "INT-001"
	}
}
```

2.  Generated XML Context (Full Version)
    xml
    <intent_context>
    <id>INT-001</id>
    <name>Weather API</name>
    <status>ACTIVE</status>
        <constraints>
            <constraint>Use OpenWeather API</constraint>
            <constraint>Rate limit: 60 requests/minute</constraint>
        </constraints>

        <owned_scope>
            <scope>src/api/weather/**</scope>
            <scope>src/models/weather.ts</scope>
        </owned_scope>

        <acceptance_criteria>
            <criteria>Unit tests in tests/api/weather/ pass</criteria>
            <criteria>API documentation generated</criteria>
        </acceptance_criteria>

        <recent_activity>
            <!-- Activity 1 (2/19/2026, 10:00:00 AM) -->
            <modified_file path="src/api/weather/fetch.ts" />

            <!-- Activity 2 (2/19/2026, 9:30:00 AM) -->
            <modified_file path="src/api/weather/types.ts" />
        </recent_activity>
    </intent_context>
3.  Tool Response (Full Version)
    json
    {
    "status": "success",
    "message": "✅ Intent INT-001 selected successfully",
    "context": "<xml_context>",
    "trace_count": 2,
    "timestamp": "2026-02-19T10:30:00Z",
    "intent_id": "INT-001",
    "summary": {
    "id": "INT-001",
    "trace_count": 2,
    "has_constraints": true,
    "has_scope": true,
    "has_traces": true
    }
    }
4.  Error Response
    json
    {
    "status": "error",
    "message": "Intent INT-999 not found in active_intents.yaml",
    "suggestion": "Check .orchestration/active_intents.yaml for valid intent IDs"
    }
    🧪 Test Coverage
    Test File Tests Description
    src/**tests**/phase1-handshake.test.ts 4 tests Unit tests for trace loading and XML generation
    src/**tests**/phase1-integration.test.ts 3 tests End-to-end flow verification
    Run tests:

bash
pnpm test src/**tests**/phase1-handshake.test.ts
pnpm test src/**tests**/phase1-integration.test.ts
📁 File Structure Summary
src/
├── core/
│ ├── prompts/
│ │ ├── system.ts # Modified with intent requirement
│ │ └── intentRequirement.ts # MANDATORY rules text
│ └── tools/
│ ├── SelectActiveIntentTool.ts # Intent selection tool (UPDATED)
│ └── toolRegistration.ts # Tool registry
├── hooks/
│ ├── index.ts # Hook registry
│ ├── preHooks.ts # intentGatekeeper, commandClassifier
│ ├── postHooks.ts # traceRecorder, lessonRecorder
│ ├── integration.ts # Hook initialization
│ └── utils/
│ └── intentLoader.ts # YAML parser + trace loader (UPDATED)
└── **tests**/
├── phase1-handshake.test.ts # Unit tests (NEW)
└── phase1-integration.test.ts # Integration tests (NEW)
