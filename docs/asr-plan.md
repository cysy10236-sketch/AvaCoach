# ASR Plan

## Why ASR Is Needed

AvaCoach should eventually let candidates answer by voice, not only by typing.

Voice answers make the demo closer to a real interview because candidates can practice:

- Speaking under interview pressure.
- Answer pacing.
- Verbal structure.
- Natural follow-up conversation.

Text input should remain as fallback for browser permission issues, noisy environments, or provider failures.

## Future Flow

```text
Candidate microphone
-> browser recording
-> /api/asr/transcribe
-> Volcano ASR
-> transcript
-> existing Submit Answer flow
```

The important product decision is to reuse the current text answer pipeline. ASR only produces the transcript; the existing interview API can still evaluate, score, and generate follow-up questions.

## Provider Plan

```bash
ASR_PROVIDER=volcano
ASR_PROVIDER=mock
```

Volcano is the planned first real ASR provider because the project is moving toward Chinese IT interview scenarios and Volcano/Doubao voice capabilities.

Mock ASR should remain available for stable demo fallback.

## Future Environment Variables

```bash
ASR_PROVIDER=mock
VOLCANO_ASR_APP_ID=
VOLCANO_ASR_ACCESS_KEY_ID=
VOLCANO_ASR_SECRET_ACCESS_KEY=
VOLCANO_ASR_ENDPOINT=
```

No ASR credentials should ever be exposed to the frontend.

## Risks

- Browser microphone permission can be denied.
- Browser recording formats vary, commonly `audio/webm`, `audio/ogg`, or WAV after conversion.
- Sampling rate and channel count may need normalization before upload.
- Streaming ASR and non-streaming ASR have different UX and backend contracts.
- Provider authentication and quota failures must fall back to typed answers.
- Live interview demos need a visible fallback path if the microphone or network fails.

## Demo Fallback

If ASR is unavailable:

- Keep the answer text box.
- Let users type the candidate answer.
- Keep the existing Submit Answer flow.
- Keep AvatarKit TTS lip-sync for interviewer replies when TTS is available.
