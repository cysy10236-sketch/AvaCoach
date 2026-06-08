# AvaCoach Final Submission

## Summary

AvaCoach is a working AI digital human interview coach demo for Chinese IT mock interviews. It integrates Spatius AvatarKit Direct Mode, a backend-minted short-lived session token, DeepSeek/OpenAI/mock LLM providers, Volcano/OpenAI/mock TTS providers, Volcano Streaming ASR, TTS-to-PCM playback, AvatarKit lip-sync, a Chinese structured IT question bank, expectedPoints-based scoring, fallback modes, and a complete interview flow.

This is a demo/prototype, not a production-grade system. The delivery focuses on engineering completeness, provider boundaries, secure key handling, fallback stability, and an interview-ready product narrative.

## Completed Capabilities

- React + Vite + TypeScript frontend.
- Node.js + Express + TypeScript backend.
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
- Chinese interview prompt style.
- Chinese IT question bank with about 110 questions.
- Frontend / Backend / AI / Behavioral categories.
- expectedPoints / followUps / topic / difficulty metadata.
- Server-side interview state machine.
- Natural follow-up control.
- 0-100 scoring with expectedPoints coverage calibration.
- coveredPoints / missingPoints / improvementTips / scoringReason.
- Final report.
- Three-column SaaS workstation UI.
- Robust fallback across Avatar, TTS, ASR, LLM, and Spatius token.

## Latest Interview Flow Fix

The newest delivery round fixed interview flow and scoring consistency:

- Backend session state is now authoritative.
- `/api/interview/next` no longer trusts only frontend status.
- `/api/interview/report` marks the server session as ended.
- `status / nextAllowed / reportReady / shouldEnd` are derived consistently.
- Once ended, another submit does not generate a new follow-up.
- Max-round completion leads the user to End Interview and Final Report.
- Report state only allows viewing the report or resetting the demo.

This removes the previous conflict where Ava could say the interview had ended while the system still generated another question.

## Latest Scoring Fix

Scoring is now consistent and explainable:

- Score scale is always 0-100.
- Mock fallback also returns 0-100 scores.
- Question-bank mode uses expectedPoints coverage as a calibration signal.
- Feedback includes coveredPoints, missingPoints, improvementTips, and scoringReason.
- scoringReason explains the score in plain language.
- Strong, complete answers can receive appropriately high scores.
- Short or “I do not know” answers are handled gently but scored realistically.

## Fallback Strategy

Fallback is part of the demo design:

- Spatius token failure -> fallback demo remains usable.
- AvatarKit failure -> placeholder / text mode.
- TTS failure -> browser speech or silent text mode.
- ASR failure -> browser speech recognition or manual input.
- LLM failure -> mock provider.
- Question-bank filtering miss -> same-role fallback question.

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
- No enterprise JD-specific question generation yet.
- Further production hardening would require persistence, rate limiting, monitoring, and privacy review.

## Build Status

`npm run build` passes. Existing AvatarKit WASM / chunk size warnings are known non-blocking warnings.
