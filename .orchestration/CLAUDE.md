# Lessons Learned - Shared Brain

_Knowledge Base - Updated: 2026-02-21 15:45:00_

## 📚 Lesson Learned: 2026-02-21 15:31:00

- **Intent:** INT-001
- **Type:** insight
- **Tool:** write_to_file
- **Message:** OpenWeather API requires API key in query parameters, not headers
- **Details:**
    ```json
    {
      "api": "OpenWeather",
      "issue": "401 Unauthorized errors",
      "root_cause": "API key sent in headers instead of query params"
    }
    Resolution: Updated fetch.ts to append ?appid={API_KEY} to URL
    ```

Tags: api, authentication, discovery

📚 Lesson Learned: 2026-02-21 15:37:00
Intent: INT-001

Type: failure

Tool: execute_command

Message: Test failed: WeatherAPI should return 200

Details:

json
{
"test": "weather.test.ts",
"error": "Connection timeout",
"attempts": 3
}
Resolution: Added retry logic with exponential backoff

Tags: testing, error-handling

📚 Lesson Learned: 2026-02-21 15:41:00
Intent: INT-002

Type: failure

Tool: write_to_file

Message: JWT secret must be at least 32 characters

Resolution: Updated secret generation to use crypto.randomBytes(32)

Tags: security, cryptography

📚 Lesson Learned: 2026-02-21 15:46:00
Intent: INT-003

Type: success

Tool: write_to_file

Message: API documentation follows OpenAPI 3.0 spec

Tags: documentation, best-practice

🏛️ Architecture Decisions
2026-02-21: Using OpenWeather API for weather data

2026-02-21: JWT tokens with 1-hour expiry

2026-02-21: Rate limiting: 60 requests per minute per API key

🎯 Coding Standards
Use async/await, no raw callbacks

2 spaces for indentation

JSDoc comments for all public functions

Unit tests required for all new features

text

### Step 4: Verify your active_intents.yaml

```bash
code .orchestration/active_intents.yaml
Make sure it has this content:

yaml
active_intents:
  - id: "INT-001"
    name: "Build Weather API"
    status: "ACTIVE"
    owned_scope:
      - "src/api/weather/**"
    constraints:
      - "Must use OpenWeather API"
      - "Rate limit: 60 requests/minute"
    acceptance_criteria:
      - "Unit tests in tests/api/weather/ pass"
      - "API documentation generated"
    created_at: "2026-02-21T10:00:00Z"
    updated_at: "2026-02-21T15:30:00Z"

  - id: "INT-002"
    name: "User Authentication"
    status: "ACTIVE"
    owned_scope:
      - "src/auth/**"
      - "src/middleware/authMiddleware.ts"
    constraints:
      - "JWT tokens only, no sessions"
      - "Password hashing with bcrypt"
    acceptance_criteria:
      - "Auth tests pass"
      - "Security audit completed"
    created_at: "2026-02-21T10:05:00Z"
    updated_at: "2026-02-21T15:40:00Z"

  - id: "INT-003"
    name: "API Documentation"
    status: "COMPLETED"
    owned_scope:
      - "README.md"
      - "docs/**"
    constraints:
      - "Must follow OpenAPI 3.0 spec"
    acceptance_criteria:
      - "Documentation covers all endpoints"
    created_at: "2026-02-21T10:10:00Z"
    updated_at: "2026-02-21T15:45:00Z"
```
