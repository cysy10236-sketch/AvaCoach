# AvaCoach Final Submission

## 1. Product Concept

AvaCoach is an AI Digital Human Mock Interviewer. It helps candidates practice interviews with a digital human interviewer, receive follow-up questions, hear spoken interviewer replies, and review structured feedback after the session.

The product is designed as a complete interview coaching experience rather than a simple chatbot. It combines role-based interview flow, LLM intelligence, TTS voice output, and the Spatius digital human avatar layer.

AvaCoach is a working AI digital human interview coach demo. It integrates Spatius AvatarKit Direct Mode, a backend-minted short-lived session token, DeepSeek/OpenAI/mock LLM providers, Volcano/OpenAI/mock TTS providers, TTS-to-PCM conversion, AvatarKit lip-sync playback, fallback modes, and a complete interview flow.

## 2. Why This Product

Interview practice is a strong fit for digital humans because interviews are not only about content. They also involve presence, pressure, timing, expression, and structure.

A text chatbot can ask questions, but it does not create the same sense of being interviewed. A digital human interviewer makes the practice more realistic and helps users train:

- Verbal expression.
- Answer structure.
- Confidence under pressure.
- STAR-style storytelling.
- Follow-up question handling.

This makes AvaCoach a practical and creative use case for a digital human SDK.

## 3. What I Built

Completed deliverables:

- Role-based mock interview flow.
- Provider-based LLM dynamic interviewer with OpenAI, DeepSeek, and mock fallback.
- Provider-based TTS voice pipeline with OpenAI, Volcano/Doubao V3 HTTP Chunked, browser speech, and silent fallback.
- Structured IT question bank seed data for frontend, backend, AI, and behavioral interviews.
- Question bank metadata: role, topic, difficulty, expected points, follow-ups, tags, and source note.
- Knowledge-point feedback showing covered points, missing points, and improvement tips.
- Spatius Direct Mode Session Token endpoint verified with direct token success.
- Spatius AvatarKit Web SDK integration with real Avatar loading.
- Official Spatius sample PCM validation path.
- Real interviewer replyText to AvatarKit lip-sync path through TTS and PCM16 conversion.
- Volcano TTS returns 16 kHz mono PCM16 audio for AvatarKit.
- Start Interview and Submit Answer interviewer replies can drive digital human lip-sync when AvatarKit and backend TTS are configured.
- AvatarStage lifecycle bug fixed so normal state updates no longer destroy the AvatarKit runtime.
- Backend-only API key handling.
- Fallback avatar placeholder.
- Conversation UI.
- Feedback panel with score, feedback, suggestion, and final report.
- Demo script.
- Spatius integration notes.
- Product suggestions for Spatius SDK.

The current demo is fully usable even if any provider falls back.

## 4. Technical Architecture

```text
Frontend
-> Interview API
-> LLM Provider / Mock
-> TTS / Browser Speech
-> PCM16 audio path
-> Spatius Avatar Layer
-> Digital Human UI
```

Current implementation:

- `client`: React + Vite + TypeScript.
- `server`: Node.js + Express + TypeScript.
- `docs`: delivery documents, integration notes, demo script, and product suggestions.

Security boundary:

- Provider API keys stay in `server/.env`.
- The frontend only receives safe responses, audio output, and future short-lived Session Tokens.

## 5. Spatius Integration Status

Completed:

- Backend Session Token route: `GET /api/spatius/session-token`.
- Direct Mode token success verified.
- Direct Mode credential boundary.
- Official `@spatius/avatarkit` package installed.
- `AvatarStage` component created with Connect Avatar and Send Sample Audio controls.
- SDK initialization follows the official Web Direct Mode quickstart order.
- Connect Avatar can load the real Avatar.
- Bundled PCM16 mono 16 kHz sample audio is sent with `controller.send(audioData, true)`.
- Interviewer TTS audio is decoded, resampled to 16 kHz mono PCM16, and sent to AvatarKit for lip-sync.
- Volcano/Doubao TTS V3 HTTP Chunked returns 16 kHz mono PCM16 for Chinese interviewer voices.
- Fallback avatar placeholder.
- UI state model for avatar status.
- TTS audio pipeline connected to AvatarKit speech playback.

Pending:

- ASR voice answer input.
- Larger enterprise/JD/custom question bank expansion.
- Stronger technical rubrics.
- Token refresh before expiration.
- Production-grade SDK error handling.
- Production deployment.

I do not claim realtime conversation, microphone input, ASR, a production-scale enterprise question bank, or production deployment is completed yet. The current implementation follows the official sample-audio validation path and adds a product path where real interviewer TTS replies are converted or passed through as AvatarKit-compatible PCM for lip-sync.

The current IT question bank is a demo seed bank, not a scraped external dataset. It is intentionally small and structured for live demonstration. It can be replaced later by enterprise-owned role banks, JD-generated question sets, or user-customized question banks.

## 6. Demo Stability Strategy

AvaCoach is designed so that every external dependency has a fallback:

- No OpenAI key -> mock interview logic.
- LLM failure -> mock interview logic.
- No TTS -> browser speech.
- Browser speech does not drive avatar lip-sync.
- No browser speech -> silent text mode.
- No Spatius token -> avatar placeholder.
- No Avatar ID -> avatar placeholder.
- AvatarKit SDK issue -> avatar placeholder.
- TTS provider issue -> browser speech or silent text mode.
- Question bank topic mismatch -> same-role fallback question.
- Question bank role mismatch -> behavioral fallback question.
- Question bank difficulty mismatch -> ignore difficulty and keep the flow running.

This makes the interview demo stable and fully usable even when some provider credentials are not available. The frontend does not care which LLM provider is active; it receives the same interview JSON contract from the backend.

## 7. Product Suggestions

The product suggestions focus on making Spatius easier to adopt:

- Provide end-to-end business templates.
- Improve audio format guidance.
- Improve Session Token debugging.
- Provide SDK state machine examples.
- Offer a clear Direct Mode quickstart.
- Provide local demo and troubleshooting checklists.
- Explain the SDK boundary clearly.

These suggestions are based on the experience of building AvaCoach as a realistic digital human application.

## 8. Future Work

Next improvements:

- Speech input / ASR.
- Expand the seed IT question bank into enterprise role banks, JD-generated banks, and user-customized banks.
- Expand TTS observability, caching, and provider configuration for production use.
- Resume upload.
- JD-based interview generation.
- PDF report export.
- Real-time streaming LLM and TTS.
- More LLM providers such as Qwen, Gemini, Claude, or local models.
- Persistent interview history.
- Production deployment.
