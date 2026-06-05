# AvaCoach

AI Digital Human Mock Interviewer

## 1. Project Overview

AvaCoach is a demo product for AI-powered mock interviews with a digital human interviewer.

The product lets a candidate choose a target role, start an interview, answer questions, receive dynamic follow-up questions, get scored feedback, hear interviewer replies, and generate a final interview report.

The current demo is fully usable with fallback modes. The Spatius layer now runs through Direct Mode with a backend-minted Session Token, loads a real Avatar through AvatarKit, validates the SDK with the official bundled PCM sample, and can drive avatar lip-sync from real interviewer TTS replies.

## 2. Demo Features

Completed features:

- Role-based interview flow.
- Supported roles:
  - Frontend Engineer
  - Product Manager
  - AI Engineer
  - General Behavioral
- Provider-based LLM layer with OpenAI, DeepSeek, and Mock modes.
- LLM dynamic interviewer when OpenAI or DeepSeek is configured.
- Mock fallback interviewer when LLM is unavailable.
- TTS voice playback for interviewer replies when backend TTS is available.
- Volcano TTS V3 HTTP Chunked provider returning 16 kHz mono PCM16 audio.
- Avatar TTS Lip-Sync path: interviewer replyText -> backend TTS -> frontend PCM16 conversion or raw PCM passthrough -> AvatarKit.
- Browser SpeechSynthesis fallback.
- Silent text mode fallback.
- Conversation history with interviewer and candidate messages.
- Score, feedback, and suggestion after each answer.
- Final report with overall score, strengths, weaknesses, and suggestions.
- Spatius Direct Mode Session Token endpoint verified with direct token success.
- AvatarKit Web SDK package installed using the official `@spatius/avatarkit` package.
- Manual Connect Avatar flow that loads the real Avatar when credentials are configured.
- Send Sample Audio quickstart flow for official SDK lip-sync validation.
- Bundled PCM16 mono 16 kHz sample audio for first AvatarKit validation.
- Interviewer replies from Start Interview and Submit Answer can drive AvatarKit lip-sync when AvatarKit and backend TTS are available.
- AvatarStage lifecycle bug fixed: ordinary state updates no longer destroy the AvatarKit runtime.
- Fallback avatar placeholder.
- Demo script and delivery documentation.

## 3. Architecture

```text
Candidate Answer
-> Frontend Conversation UI
-> Interview API
-> LLM / Mock Fallback
-> TTS / Browser Speech / Silent Fallback
-> Spatius Avatar Layer
-> Digital Human Interviewer UI
```

Repository structure:

```text
client/   React + Vite + TypeScript frontend
server/   Node.js + Express + TypeScript backend
docs/     Delivery docs, integration notes, demo script
```

Security boundary:

- API keys are backend-only.
- Frontend never receives OpenAI or Spatius API keys.
- Frontend will only use public Spatius IDs and short-lived Session Tokens.

## 4. Current Status

Completed:

- React + Express monorepo.
- Mock interview flow.
- LLM integration with fallback.
- TTS / browser speech / silent fallback.
- AvatarKit lip-sync for interviewer replies when real avatar and backend TTS are available.
- Spatius Direct Mode Session Token endpoint verified.
- AvatarKit SDK package installed and connected.
- Official-style sample PCM validation path.
- Volcano TTS V3 HTTP Chunked integration.
- Frontend PCM path from TTS to AvatarKit controller.
- AvatarStage component created.
- Fallback avatar placeholder.
- Final report.
- Demo script.
- Spatius integration docs.
- Product suggestions for Spatius SDK.

Pending:

- ASR voice answer input.
- IT question bank.
- Production deployment.

Important note:

The Avatar area no longer requires a manually pasted `VITE_SPATIUS_SESSION_TOKEN`. It calls the backend `GET /api/spatius/session-token` endpoint, receives a short-lived token, and initializes AvatarKit only after the user clicks Connect Avatar. Without valid configuration, it falls back to the placeholder. The demo flow is still fully usable.

## 5. Tech Stack

Frontend:

- React
- Vite
- TypeScript

Backend:

- Node.js
- Express
- TypeScript

Provider integrations:

- Provider-based LLM through backend API.
- OpenAI and DeepSeek LLM providers.
- Provider-based TTS through backend API.
- TTS providers: OpenAI, Volcano/Doubao V3 HTTP Chunked, Mock fallback.
- Browser audio decoding and PCM16 conversion for AvatarKit.
- Spatius Direct Mode token endpoint.

## 6. Local Setup

Install dependencies from the repository root:

```bash
npm install
```

## 7. Environment Variables

Create backend secrets in `server/.env`. Do not commit this file.

```bash
PORT=3001
CLIENT_ORIGIN=http://localhost:5173

LLM_PROVIDER=openai

OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini

DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-v4-flash

TTS_PROVIDER=openai

# OpenAI TTS
TTS_MODEL=gpt-4o-mini-tts
TTS_VOICE=alloy

# Volcano / Doubao TTS
VOLCANO_TTS_ENABLED=false
VOLCANO_TTS_PROVIDER=volcano_bidirection
VOLCANO_TTS_RESOURCE_ID=seed-tts-2.0
VOLCANO_TTS_VOICE_TYPE=zh_female_vv_uranus_bigtts
VOLCANO_TTS_FORMAT=pcm
VOLCANO_TTS_SAMPLE_RATE=16000
VOLCANO_TTS_SPEECH_RATE=0
VOLCANO_TTS_DISABLE_MARKDOWN_FILTER=true
VOLCANO_TTS_ENABLE_LANGUAGE_DETECTOR=false
VOLCANO_ACCESS_KEY_ID=
VOLCANO_SECRET_ACCESS_KEY=
VOLCANO_APP_ID=
VOLCANO_TTS_API_KEY=
VOLCANO_TTS_ENDPOINT=https://openspeech.bytedance.com/api/v3/tts/unidirectional

SPATIUS_API_KEY=
SPATIUS_APP_ID=
SPATIUS_REGION=us-west
SPATIUS_TOKEN_EXPIRE_MINUTES=30
SPATIUS_INCLUDE_APP_ID_IN_TOKEN_REQUEST=false
```

Frontend public variables live in `client/.env`:

```bash
VITE_SPATIUS_APP_ID=
VITE_SPATIUS_AVATAR_ID=
```

Rules:

- Never put `OPENAI_API_KEY` in `client/.env`.
- Never put `DEEPSEEK_API_KEY` in `client/.env`.
- Never put `SPATIUS_API_KEY` in `client/.env`.
- Do not put a long-lived API key or manually minted `VITE_SPATIUS_SESSION_TOKEN` in the frontend.
- The frontend requests a short-lived Session Token from the backend when Connect Avatar is clicked.
- `.env` files are ignored by git.
- Missing keys should not break the demo because fallback modes are built in.

LLM provider options:

```bash
LLM_PROVIDER=openai
LLM_PROVIDER=deepseek
LLM_PROVIDER=mock
```

DeepSeek model options:

```bash
DEEPSEEK_MODEL=deepseek-v4-flash
DEEPSEEK_MODEL=deepseek-v4-pro
```

`deepseek-v4-flash` is the default recommendation for AvaCoach because it is faster and lower cost for real-time interview follow-up. `deepseek-v4-pro` is better for more complex reasoning or higher-quality reports.

TTS provider options:

```bash
TTS_PROVIDER=openai
TTS_PROVIDER=volcano
TTS_PROVIDER=mock
```

OpenAI and Volcano/Doubao are runnable TTS providers when their backend keys are configured. Volcano uses the V3 HTTP Chunked unidirectional endpoint and returns PCM audio chunks that AvaCoach concatenates into 16 kHz mono PCM16 before the frontend sends it to AvatarKit. Mock forces Browser Speech / Silent Text fallback.

## 8. How to Run

Start both frontend and backend:

```bash
npm run dev
```

Open:

```text
http://localhost:5173
```

Backend health check:

```text
http://localhost:3001/health
```

Build:

```bash
npm run build
```

## 9. Fallback Strategy

Fallback is part of the demo stability design, not an error state.

- No OpenAI key -> mock interview logic.
- No DeepSeek key -> mock interview logic.
- `LLM_PROVIDER=mock` -> forced mock interview logic.
- LLM request fails -> mock interview logic.
- No backend TTS -> browser speech fallback.
- Browser speech fallback does not drive avatar lip-sync.
- Browser speech unavailable -> silent text mode.
- No Spatius API key -> token fallback.
- No Avatar ID -> avatar placeholder.
- Avatar SDK failure in the future -> keep placeholder and text interview available.

This ensures the interview flow remains fully usable in live demos.

## 10. Spatius Integration Notes

Spatius is positioned as the digital human avatar rendering and driving layer.

In AvaCoach, Spatius is not the LLM and not the business logic engine. The planned role of Spatius is:

- Render the digital human interviewer.
- Drive the avatar with TTS audio.
- Provide lip sync and motion.
- Expose SDK state events to the UI.

Current Spatius-related work:

- Backend Session Token endpoint completed and verified in Direct Mode.
- API key kept backend-only.
- `@spatius/avatarkit` installed.
- Official-style Connect Avatar / Send Sample Audio path created.
- Connect Avatar can load the real Avatar with configured App ID, Avatar ID, Session Token, and region.
- Bundled sample PCM audio copied to `client/public/audio/quickstart_voice.pcm`.
- Frontend state model prepared.
- Fallback avatar placeholder active.
- Volcano TTS can return 16 kHz mono PCM16 audio.
- TTS audio pipeline can now drive AvatarKit lip-sync after conversion or raw PCM passthrough to PCM16 mono 16 kHz.
- AvatarStage cleanup lifecycle bug fixed so Start Interview and Submit Answer do not destroy the connected runtime.

See [docs/spatius-integration.md](docs/spatius-integration.md).

## 11. Product Suggestions

Based on this integration experience, the main suggestions for Spatius SDK are:

- Provide end-to-end business templates.
- Improve audio format guidance.
- Improve Session Token debugging.
- Provide SDK state machine and UI mapping examples.
- Provide a clear Direct Mode quickstart.
- Provide local demo and troubleshooting checklist.
- Explain SDK boundaries clearly.

See [docs/product-suggestions.md](docs/product-suggestions.md).

## 12. Future Work

Next steps:

- Improve generated TTS voice selection for the selected avatar.
- Add robust ASR voice answers.
- Add speech input / ASR.
- Add IT question bank and structured technical rubrics.
- Add resume upload.
- Add JD-based interview generation.
- Add PDF report export.
- Add real-time streaming.
- Prepare production deployment.

## Useful Docs

- [Final Submission](docs/final-submission.md)
- [Demo Script](docs/demo-script.md)
- [Interview Pitch](docs/interview-pitch.md)
- [Spatius Integration Notes](docs/spatius-integration.md)
- [Product Suggestions](docs/product-suggestions.md)
- [LLM Integration](docs/llm-integration.md)
- [Provider Architecture](docs/provider-architecture.md)
- [TTS Integration](docs/tts-integration.md)
- [ASR Plan](docs/asr-plan.md)
