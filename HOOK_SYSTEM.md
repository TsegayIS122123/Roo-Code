## 6. Edge Cases and Failure Recovery

### 6.1 Missing active_intents.yaml

**Scenario:** The `.orchestration/active_intents.yaml` file doesn't exist.

**Behavior:**

- `loadActiveIntents()` returns `{ active_intents: [] }` (not throw)
- `getIntentById()` returns `undefined`
- `getIntentContext()` returns empty string
- `select_active_intent` tool returns error: "Intent not found"

**Recovery:** User must create the YAML file with valid intents.

### 6.2 Malformed YAML

**Scenario:** The YAML file has syntax errors.

**Behavior:**

- `yaml.load()` throws an error
- Caught by try/catch, returns empty array
- Error logged to console but doesn't crash extension

**Recovery:** User must fix YAML syntax.

### 6.3 Intent Not Found

**Scenario:** Agent calls `select_active_intent` with non-existent ID.

**Behavior:**

- Tool returns error: "Intent INT-999 not found"
- LLM receives structured error
- LLM can self-correct and try another ID

**Recovery:** LLM should ask user for valid intent ID.

### 6.4 File Outside Owned Scope

**Scenario:** Agent tries to write to file not in intent's `owned_scope`.

**Behavior:**

- `scopeEnforcer` pre-hook blocks the write
- Returns error: "SCOPE_VIOLATION"
- Error includes allowed scopes for context

**Recovery:** LLM can request scope expansion or choose different intent.

### 6.5 Destructive Command Detection

**Scenario:** Agent tries to run `rm -rf /` or similar destructive command.

**Behavior:**

- `commandClassifier` detects pattern
- Blocks execution immediately
- Returns error: "DESTRUCTIVE_COMMAND"

**Recovery:** LLM must suggest safer alternative.

### 6.6 Concurrent Intent Selections

**Scenario:** Multiple agents select different intents simultaneously.

**Behavior:**

- Each session maintains its own `intentId`
- No cross-session interference
- File writes validated against session's intent

**Recovery:** N/A - designed for concurrency.

### 6.7 Empty owned_scope

**Scenario:** Intent has empty `owned_scope` array.

**Behavior:**

- `validateIntentScope()` returns `false` for all files
- Effectively read-only intent (can't write files)

**Recovery:** User must add scopes to intent definition.

### 6.8 Trace Recording Failures

**Scenario:** Cannot write to `.orchestration/agent_trace.jsonl` (permissions, disk full).

**Behavior:**

- `traceRecorder` catches error
- Logs to console but doesn't block execution
- Trace is lost but code still works

**Recovery:** Check filesystem permissions and space.

### 6.9 LLM Ignores Intent Requirement

**Scenario:** LLM tries to write file without calling `select_active_intent`.

**Behavior:**

- `intentGatekeeper` blocks the write
- Returns error: "INTENT_REQUIRED"
- Error includes suggestion to call intent tool

**Recovery:** LLM must backtrack and call intent tool first.

### 6.10 Session Expiration

**Scenario:** Long-running session with intent selected times out.

**Behavior:**

- Session `intentId` may be cleared
- Next tool call triggers `INTENT_REQUIRED` error
- Forces re-selection of intent

**Recovery:** Agent must re-select intent.
