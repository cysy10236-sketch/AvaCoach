# Product Suggestions for Spatius SDK

## 1. Provide End-to-End Business Templates

Spatius could reduce developer activation time by providing complete business templates instead of only SDK-level examples.

Suggested templates:

- AI interviewer.
- AI tutor.
- Customer service avatar.
- Onboarding assistant.

Each template should include:

- Frontend avatar UI.
- Backend token server.
- LLM integration.
- TTS integration.
- Avatar SDK initialization.
- Fallback behavior.

This would help developers understand how Spatius fits into a complete product, not only how to call the SDK.

## 2. Improve Audio Format Guidance

After TTS is connected, the most important integration question becomes audio compatibility.

Developers need clear answers for:

- What audio formats the SDK accepts.
- Required sample rate.
- Whether MP3, WAV, PCM, or Opus are supported.
- How to convert from common TTS providers.
- How to handle browser `AudioBuffer`, `Blob`, file, or stream inputs.
- Whether streaming audio and non-streaming audio are both supported.

Suggested additions:

- Audio adapter helper functions.
- OpenAI TTS example.
- Browser audio playback example.
- Streaming and non-streaming examples.
- Recommended format for best lip sync quality.

## 3. Improve Session Token Debugging

Direct Mode token issues should produce clear, actionable errors.

Suggested error cases:

- Token expired.
- App ID mismatch.
- Wrong region.
- Invalid API key.
- Avatar ID missing.
- Token generated for a different app.
- Session limit or quota issue.

Better error messages would reduce integration time and make demo debugging much easier.

## 4. Provide State Machine and UI Mapping Examples

Avatar SDK states should be easy to map into product UI.

Useful product states:

- connecting
- connected
- speaking
- listening
- error
- fallback

Suggested deliverable:

- A React hook example such as `useSpatiusAvatar`.
- A state mapping table.
- Recommended UI copy for each state.
- Recovery examples after SDK failure.

## 5. Provide Clear Direct Mode Quickstart

Direct Mode documentation should include the minimum working backend and frontend.

Recommended quickstart sections:

- Minimum backend code.
- Minimum frontend code.
- What is public.
- What is secret.
- Expected Session Token response shape.
- Common failure cases.
- How to verify region, app ID, and avatar ID.

The main goal is to help developers complete the first successful avatar render quickly.

## 6. Provide Local Demo and Troubleshooting Checklist

A checklist would make SDK evaluation easier.

Suggested checklist:

- Token test.
- Avatar ID test.
- Region test.
- Network test.
- Audio test.
- SDK event callback test.
- Fallback test.

This would be especially useful for hackathons, interviews, sales demos, and enterprise pilots.

## 7. Explain SDK Boundary Clearly

Developers need to understand what Spatius owns and what the application must provide.

Spatius is not responsible for:

- ASR.
- LLM reasoning.
- Business logic.
- Interview scoring.
- TTS, depending on the selected mode.

Spatius is responsible for:

- Avatar rendering.
- Driving data.
- Lip sync and motion.
- Digital human display.
- Avatar SDK state events.

Clear boundaries help teams design cleaner systems and avoid expecting the avatar SDK to solve unrelated AI workflow problems.

## 8. Why These Suggestions Matter

These improvements matter commercially because they can:

- Lower integration cost.
- Shorten time to first successful demo.
- Improve developer activation.
- Increase demo success rate.
- Make enterprise adoption easier.
- Turn digital human use cases into repeatable templates.

For AvaCoach specifically, clearer Direct Mode, audio guidance, and state mapping would make the path from fallback placeholder to real digital human much faster.
