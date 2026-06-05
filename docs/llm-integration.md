# LLM Integration Plan

## Responsibility In AvaCoach

The LLM powers the interview intelligence layer:

- Role-specific opening messages.
- Dynamic follow-up questions based on candidate answers.
- Per-answer scoring and feedback.
- Final interview reports with strengths, weaknesses, and suggestions.

The frontend calls the same backend endpoints regardless of provider:

- `POST /api/interview/start`
- `POST /api/interview/next`
- `POST /api/interview/report`

## Provider-Based Architecture

AvaCoach now supports three LLM modes:

```bash
LLM_PROVIDER=openai
LLM_PROVIDER=deepseek
LLM_PROVIDER=mock
```

Provider behavior:

- `openai`: uses OpenAI Responses API.
- `deepseek`: uses DeepSeek Chat Completions-compatible API.
- `mock`: forces deterministic mock interview logic.

If OpenAI or DeepSeek fails, AvaCoach automatically falls back to `mock`.

## Environment Variables

Backend-only variables in `server/.env`:

```bash
LLM_PROVIDER=openai

OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini

DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-v4-flash
```

Never put `OPENAI_API_KEY` or `DEEPSEEK_API_KEY` in `client/.env`.

## DeepSeek Model Choice

Default:

```bash
DEEPSEEK_MODEL=deepseek-v4-flash
```

Recommended options:

- `deepseek-v4-flash`: default recommendation for AvaCoach. It is faster and lower cost, which fits real-time interview follow-up and scoring.
- `deepseek-v4-pro`: stronger model for more complex reasoning, higher-quality feedback, and richer report generation.

`deepseek-chat` may be seen as a legacy-compatible naming style in some examples, but this project does not use it as the default.

## Why LLM Calls Stay On The Backend

Provider API keys are secrets. They must stay in `server/.env`.

The backend controls:

- Provider selection.
- API key access.
- Prompt construction.
- JSON constraints.
- Error handling and mock fallback.
- Future logging, rate limits, and moderation hooks.

## Prompt Design

AvaCoach uses a professional interviewer prompt:

- Friendly but professional.
- Adapts to Frontend Engineer, Product Manager, AI Engineer, or General Behavioral roles.
- Asks one question at a time.
- Uses candidate history to ask follow-up questions.
- Keeps answers concise.
- Scores with reference to clarity, relevance, specificity, structure, and impact.
- Encourages STAR structure where useful.
- Around three candidate rounds, suggests ending the interview.

Prompt templates live in `server/src/services/llm/prompts.ts`.

## JSON Output Contract

All providers return the same frontend contract.

Start:

```json
{
  "replyText": "...",
  "question": "...",
  "stage": "asking",
  "source": "llm",
  "provider": "openai"
}
```

Next:

```json
{
  "replyText": "...",
  "score": 7,
  "feedback": "...",
  "suggestion": "...",
  "shouldEnd": false,
  "source": "llm",
  "provider": "deepseek"
}
```

Report:

```json
{
  "overallScore": 78,
  "strengths": ["..."],
  "weaknesses": ["..."],
  "suggestions": ["..."],
  "source": "mock",
  "provider": "mock"
}
```

## Fallback Strategy

The mock interview engine remains the stable fallback path.

Fallback happens when:

- `LLM_PROVIDER=mock`.
- `LLM_PROVIDER=openai` but `OPENAI_API_KEY` is missing.
- `LLM_PROVIDER=deepseek` but `DEEPSEEK_API_KEY` is missing.
- Provider request fails.
- Provider returns invalid or non-JSON output.
- JSON parsing fails.

This prevents provider issues from breaking the demo.

## How To Verify Provider

Call:

```powershell
$body = @{ role = "frontend" } | ConvertTo-Json
Invoke-WebRequest -Uri http://localhost:3001/api/interview/start -Method Post -ContentType "application/json" -Body $body
```

Check:

- `source`
- `provider`

Expected:

- OpenAI: `source = "llm"`, `provider = "openai"`
- DeepSeek: `source = "llm"`, `provider = "deepseek"`
- Mock: `source = "mock"`, `provider = "mock"`

## Current Limits

- No streaming yet.
- No persisted interview session state.
- No provider-level cost guardrails.
- No separate evaluator model.
- No moderation layer yet.
- No per-role custom prompt tuning UI.

## References

- OpenAI Responses API: https://platform.openai.com/docs/api-reference/responses
- OpenAI Structured Outputs guide: https://platform.openai.com/docs/guides/structured-outputs
- DeepSeek API docs: https://api-docs.deepseek.com/
