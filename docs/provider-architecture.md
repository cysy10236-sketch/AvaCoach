# Provider Architecture

## Why Provider Layers Are Provider-Based

AvaCoach separates the interview API from model and voice providers so the product can switch vendors without changing the frontend.

This is useful because:

- Different demos may have different available API keys.
- Cost, speed, and quality requirements can change.
- Provider outages should not break the interview flow.
- The same business logic should work with multiple model vendors.
- Mock mode gives a stable local demo path.

## LLM Provider Interface

Each provider implements the same conceptual methods:

- `generateOpeningAndFirstQuestion(role)`
- `generateFollowUp(role, answer, history)`
- `generateFinalReport(role, history)`

All providers return the same JSON shape to the frontend.

This keeps `client` simple: it does not care whether the backend used OpenAI, DeepSeek, or Mock.

## Relationship With Spatius Avatar SDK

The LLM provider is independent from Spatius.

```text
LLM Provider -> replyText / feedback / report
TTS Provider -> audio
Spatius Avatar SDK -> digital human rendering and driving
```

Spatius should consume the final speech/audio layer, not own the interview reasoning. This makes the architecture modular:

- LLM provider can be replaced.
- TTS provider can be replaced.
- Spatius remains the avatar rendering/driving layer.

## Provider Modes

```bash
LLM_PROVIDER=openai
LLM_PROVIDER=deepseek
LLM_PROVIDER=mock
```

OpenAI:

- Default model: `gpt-4o-mini`
- Good general-purpose quality.
- Uses OpenAI Responses API with structured output.

DeepSeek:

- Default model: `deepseek-v4-flash`
- Recommended for fast and lower-cost interview follow-up.
- `deepseek-v4-pro` can be used for stronger reasoning or higher-quality reports.

Mock:

- No external dependency.
- Always available.
- Best for stable local demos and fallback.

## TTS Provider Interface

The TTS layer now uses the same adapter idea:

```bash
TTS_PROVIDER=openai
TTS_PROVIDER=volcano
TTS_PROVIDER=mock
```

Each TTS provider implements a conceptual method:

```text
synthesizeSpeech(text) -> audio or fallback
```

The `/api/tts` contract remains unchanged for the frontend:

- Success returns audio bytes such as `audio/mpeg`.
- Fallback returns JSON with `source: "browser-fallback"`.

OpenAI:

- Current runnable provider.
- Uses backend `OPENAI_API_KEY`.
- Returns audio that the frontend decodes and converts to AvatarKit PCM.

Volcano/Doubao:

- Used as the preferred Chinese interviewer voice candidate when configured.
- Uses Volcano V3 HTTP Chunked unidirectional TTS when `VOLCANO_TTS_ENABLED=true`.
- Sends `X-Api-Key`, `X-Api-Resource-Id`, and `X-Api-Request-Id` from the backend only.
- Parses chunked JSON events, decodes `code=0` base64 audio chunks, and treats `code=20000000/message=ok` as the success end event.
- Returns `audio/pcm; rate=16000; channels=1; encoding=signed-integer; bits=16` on success.
- Returns safe fallback JSON if the provider reports errors such as permission or speaker issues.

Mock:

- Forces fallback.
- Useful for proving the UI remains stable without backend TTS.

## TTS And Spatius Lip-Sync

TTS providers only generate speech audio. They do not provide mouth-shape data in this integration.

Spatius AvatarKit is responsible for deriving motion/lip-sync from audio sent through `controller.send(...)`.

All provider audio must eventually become:

```text
16 kHz / mono / PCM16 / ArrayBuffer
```

Then AvaCoach sends the PCM to AvatarKit.

If the provider already returns 16 kHz mono PCM16, such as the configured Volcano TTS path, the frontend can pass the audio bytes through as an `ArrayBuffer`. If the provider returns compressed audio, the frontend decodes, resamples, mixes to mono, and converts to PCM16 before calling `controller.send(pcm, true)`.

The official sample PCM file is kept as an SDK validation tool. Product speech uses the interviewer `replyText -> TTS -> PCM16 -> AvatarKit` path.

## Avatar Runtime Lifecycle

AvatarKit is stateful and should not be recreated for ordinary interview state updates.

The current frontend keeps the AvatarKit runtime in a ref inside `AvatarStage`. `Start Interview`, `Submit Answer`, voice mode changes, and speech interruption do not destroy the runtime. Destroy is reserved for true component unmount or explicit future disconnect/reset behavior.

A lifecycle bug was fixed during integration: an effect cleanup depended on an inline callback from `App.tsx`, so Start Interview changed the callback identity and React ran the old cleanup. That destroyed AvatarKit immediately after connection. The fix stores the latest callback in a ref and uses an empty-dependency cleanup effect.

## Future Provider Extensions

The same interface can support:

- Qwen.
- Gemini.
- Claude.
- Local models.
- Enterprise private model endpoints.
- Volcano ASR for spoken candidate answers.

Only a new provider adapter is needed as long as it returns the same interview JSON contract.

## Why This Matters For AvaCoach

Provider-based LLM design keeps the product resilient. The interview demo can run in low-cost, high-quality, offline-like, or fallback modes without changing the UI.

It also keeps the Spatius integration cleaner. The avatar layer does not need to know which LLM provider generated the reply; it only needs the final text/audio and state events.
