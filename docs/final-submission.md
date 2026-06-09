# AvaCoach Final Submission

## Summary

AvaCoach is a working Chinese AI digital human interview coach demo. It integrates Spatius AvatarKit Direct Mode, a backend-minted short-lived session token, DeepSeek/OpenAI/mock LLM providers, Volcano/OpenAI/mock TTS providers, Volcano Streaming ASR, TTS-to-PCM playback, AvatarKit lip-sync, a retained Chinese IT question-bank asset, fallback modes, and a complete interview flow.

This is a demo/prototype, not a production-grade system. The delivery focuses on engineering completeness, provider boundaries, secure key handling, fallback stability, and an interview-ready product narrative.

## Current Interview Design

The primary demo path now uses an **AI dynamic interview** strategy:

- Role and Topic guide the first question.
- LLM decides whether to follow up, change angle, lower difficulty, or close the round.
- Feedback is shown as natural summary, scoring reason, improvement suggestions, and final report.
- The UI no longer exposes rigid question-bank scoring fields such as covered/missing points.

The structured IT question bank remains in the repository as a serious knowledge asset. It contains about 110 Chinese IT questions with role, topic, difficulty, expectedPoints, followUps, and tags. It is intentionally retained for future evaluator/rubric work, offline testing, enterprise JD customization, and topic curriculum design.

In short: the demo experience is dynamic and natural; the question bank remains as an expandable assessment foundation.

## Completed Capabilities

- React + Vite + TypeScript frontend.
- Node.js + Express + TypeScript backend.
- Three-column SaaS workstation UI.
- Spatius AvatarKit Direct Mode integration.
- Backend Session Token endpoint for Spatius.
- Real Avatar loading and render-ready flow.
- Official sample PCM validation.
- Volcano TTS V3 HTTP Chunked integration.
- TTS output as 16kHz / mono / PCM16.
- Frontend sends TTS PCM to AvatarKit for lip-sync.
- Volcano Streaming ASR via backend WebSocket proxy.
- Browser microphone capture as PCM16 / 16kHz / mono.
- Partial and final transcript refill into the answer box.
- Text answer and voice answer both supported.
- DeepSeek / OpenAI / Mock LLM providers.
- Chinese interviewer prompt style.
- Dynamic Topic-guided interview flow.
- Chinese IT question bank retained as structured asset.
- Server-side interview state machine.
- 0-100 scoring with user-friendly scoring reason.
- Final report.
- Robust fallback across Avatar, TTS, ASR, LLM, and Spatius token.

## What Changed From Earlier Question-bank Mode

Earlier versions exposed the question bank directly in the main UI and showed coveredPoints / missingPoints after every answer. That was useful for validating scoring mechanics, but it made the interview feel too mechanical.

The current version keeps the bank but removes it from the main demo path. This makes Ava behave more like a real interviewer while preserving the engineering rigor of a structured knowledge base.

## Security

- API keys are backend-only.
- Real `.env` files are not committed.
- No real API keys, session tokens, or Avatar IDs are included in docs.
- Frontend uses public Vite variables and backend-generated short-lived tokens only.
- Debug output avoids complete keys, headers, tokens, and audio payloads.

## Known Limitations

- Not production deployed.
- No user account or interview history persistence.
- Report export buttons are UI placeholders.
- The retained question bank is not yet a production rubric engine.
- Further production hardening would require persistence, rate limiting, monitoring, privacy review, and evaluator calibration.

## Build Status

`npm run build` passes. Existing AvatarKit WASM / chunk size warnings are known non-blocking warnings.
