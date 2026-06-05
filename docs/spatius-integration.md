# Spatius SDK Integration Notes

## 1. Integration Goal

In AvaCoach, Spatius is the digital human avatar rendering and driving layer.

It is not responsible for the interview logic, LLM reasoning, or TTS generation. Those parts live in the AvaCoach backend. Spatius is responsible for making the interviewer visible as a digital human in the browser, and later driving the avatar with audio so it can speak with lip sync and motion.

Spatius should handle:

- Digital human avatar rendering.
- Frontend avatar display.
- Audio-driven speaking behavior.
- Lip sync and motion alignment.
- SDK state events for avatar connection and playback.

## 2. AvaCoach Architecture

```text
Candidate Answer
-> Interview API
-> LLM / Mock Fallback
-> TTS / Browser Speech / Silent Fallback
-> PCM16 conversion when TTS audio is available
-> Spatius Avatar SDK
-> Digital Human Interviewer
```

Current AvaCoach separates responsibilities clearly:

- React UI handles the interview experience.
- Express API protects credentials and coordinates providers.
- LLM generates dynamic interview questions and reports when configured.
- Mock fallback keeps the product usable without LLM.
- TTS prepares audio for interviewer replies.
- Spatius renders and drives the real digital human avatar when App ID, Avatar ID, region, and backend Session Token are configured.

## 3. Current Integration Status

Completed:

- Backend session token endpoint: `GET /api/spatius/session-token`.
- Spatius Direct Mode Session Token verified with `mode: "direct"` and `fallback: false`.
- `SPATIUS_API_KEY` is backend-only.
- Official `@spatius/avatarkit` package installed in `client`.
- Vite AvatarKit plugin configured for WASM handling.
- `AvatarStage` component created.
- AvatarKit SDK initialization now follows the official Web Direct Mode quickstart shape.
- Connect Avatar loads the real Avatar when credentials are configured.
- Send Sample Audio validates SDK rendering and lip-sync with the official bundled PCM sample.
- Bundled sample PCM audio is available at `client/public/audio/quickstart_voice.pcm`.
- Fallback avatar placeholder remains available in the UI.
- Volcano TTS V3 HTTP Chunked is integrated.
- Volcano TTS returns 16 kHz mono PCM16 audio.
- Frontend can send TTS PCM to AvatarKit with `controller.send(pcm, true)`.
- Start Interview and Submit Answer interviewer replies can drive avatar lip-sync.
- AvatarStage lifecycle bug fixed so ordinary state updates do not destroy the AvatarKit runtime.
- UI state mapping prepared through `AvatarStatus`.
- Token fallback behavior prepared for live demo stability.

Pending:

- Token refresh before expiration.
- Production-grade SDK error handling.
- ASR voice answer input.
- IT question bank and technical rubric expansion.

## 4. Credentials and Security

Credential boundary:

- `SPATIUS_API_KEY` lives only in `server/.env`.
- `VITE_SPATIUS_APP_ID` can live in `client/.env`.
- `VITE_SPATIUS_AVATAR_ID` can live in `client/.env`.
- Session Token is generated dynamically by the backend.
- The frontend must never receive the Console API key.
- `.env` files are ignored by git.

Changing the avatar appearance:

- Copy the new Avatar ID from the Spatius role/avatar library.
- Put it in `client/.env` as `VITE_SPATIUS_AVATAR_ID=`.
- Restart `npm run dev`.
- Click Connect Avatar again.
- Do not commit the real Avatar ID if it should stay private, and do not paste it into docs.

Why this matters:

Any `VITE_*` value is bundled into browser assets and can be inspected by users. The Spatius Console API key is a secret, so it must stay behind the Express server. The browser should only receive short-lived Session Tokens and public identifiers.

## 5. Session Token Flow

1. Frontend calls `GET /api/spatius/session-token`.
2. Backend reads `SPATIUS_API_KEY` from `server/.env`.
3. Backend requests a short-lived Session Token from Spatius Console API.
4. Frontend receives the Session Token.
5. Avatar SDK uses the Session Token to connect.
6. If token creation fails, the UI keeps using the fallback placeholder.

Current backend request:

```http
POST https://<region-console-host>/v1/console/session-tokens
Content-Type: application/json
X-Api-Key: <backend-only key>
```

Current request body:

```json
{
  "expireAt": 1710000000
}
```

Per the current API Reference, `expireAt` is a Unix timestamp in seconds and `appId` is shown in the Session Token request body. AvaCoach keeps `SPATIUS_INCLUDE_APP_ID_IN_TOKEN_REQUEST=false` by default so the request can stay conservative, but the backend now supports enabling this field for compatibility testing:

```env
SPATIUS_INCLUDE_APP_ID_IN_TOKEN_REQUEST=true
```

When this flag is true, the backend sends `appId` from `SPATIUS_APP_ID`. Debug only reports `requestShape.hasAppId`; it never returns the full App ID.

`modelVersion` is marked as a reserved field and should be omitted.

Region mapping:

- `SPATIUS_REGION=us-west` -> `console.us-west.spatius.ai`
- `SPATIUS_REGION=ap-northeast` -> `console.ap-northeast.spatius.ai`

Current response shape:

```json
{
  "sessionToken": "...",
  "expireAt": 1710000000,
  "mode": "direct",
  "fallback": false
}
```

The token service accepts multiple possible token field names while debugging the Console API response shape:

- `sessionToken`
- `sessionKey`
- `session_token`
- `token`
- `accessToken`
- `data.sessionToken`
- `data.sessionKey`
- `data.session_token`
- `data.token`
- `result.sessionToken`
- `result.sessionKey`
- `result.token`

It also returns safe debug metadata on fallback, including status, content type, top-level keys, nested keys, and redacted token previews. It never returns or logs `SPATIUS_API_KEY`.

Historical Session Token debugging:

- The request originally reached the Console API but returned `errors` instead of a token.
- Safe debug was added for top-level keys, nested keys, auth scheme, endpoint host, region, request shape, and sanitized errors.
- The blocker has now been resolved in local testing: `/api/spatius/session-token` can return `mode: "direct"`, `fallback: false`, `authSchemeUsed: "x-api-key"`, and `endpointHost: "console.us-west.spatius.ai"`.

Safe debug fields now include:

- `cwd`
- `envFileLoaded`
- `envFilePathExists`
- `hasApiKey`
- `apiKeyLength`
- `apiKeyLooksLikeSkPrefix`
- `apiKeyHasWhitespace`
- `apiKeyHasQuotes`
- `hasAppId`
- `appIdLooksLikeAppPrefix`
- `endpointHost`
- `region`
- `attemptedAuthSchemes`
- `authSchemeUsed`
- `requestShape`
- `safeErrors`

The backend first attempts the documented `X-Api-Key` header. If the response indicates an auth/API-key problem, it safely retries with `Authorization: Bearer <key>` for diagnostics. It only reports which schemes were attempted or succeeded; it never returns header values.

Recent debug result:

- The Console API returned HTTP 200 with JSON.
- `debug.topLevelKeys` was `["errors"]`.
- No recognized token candidate existed.
- This means the request reached the Console API, but the API returned a validation/auth/business error instead of generating a token.
- Newer debug showed `safeErrors` containing `INVALID_ARGUMENT` and `invalid api key` while `hasApiKey=true`. The next checks are key formatting, region mismatch, documented host mismatch, and whether the token API expects `appId`.

The backend now extracts safe error details from `errors`, `data.errors`, `result.errors`, `error`, `data.error`, and `result.error`. Only these non-sensitive fields are exposed:

- `code`
- `message`
- `field`
- `path`
- `reason`

It also returns a safe `debug.requestShape` object:

- Whether `appId` was sent.
- Whether `expireAt` was sent.
- The type and likely unit of `expireAt`.
- Whether `modelVersion` was sent and whether it was empty.
- Endpoint host and region.

The debug response must be used to confirm whether the real issue is `expireAt`, API key/auth, region/host, or a missing/extra request field. It never includes the API key, headers, full response body, full app ID, or full token.

Fallback response:

```json
{
  "sessionToken": null,
  "expireAt": null,
  "mode": "fallback",
  "fallback": true,
  "message": "SPATIUS_API_KEY is not configured. AvaCoach is running in fallback demo mode."
}
```

## 6. Frontend Avatar SDK Plan

This is partially implemented and now aligned with the official Web Direct Mode quickstart sample-audio path.

Implemented:

- Install `@spatius/avatarkit`.
- Create `client/src/components/AvatarStage.tsx`.
- Read `VITE_SPATIUS_APP_ID` and `VITE_SPATIUS_AVATAR_ID`.
- Fetch Session Token from `/api/spatius/session-token`.
- Call `AvatarSDK.initialize(...)`.
- Call `AvatarSDK.setSessionToken(...)`.
- Load avatar with `AvatarManager.shared.load(avatarId)`.
- Render with `new AvatarView(avatar, container)`.
- Use `avatarView.controller.initializeAudioContext()`.
- Use `avatarView.controller.start()` and wait for `ConnectionState.connected`.
- Send bundled PCM16 mono 16 kHz sample audio with `avatarView.controller.send(audioData, true)`.
- Convert real interviewer TTS replies to PCM16 mono 16 kHz and send them with `avatarView.controller.send(pcm, true)`.
- Fall back to placeholder UI if configuration, token, or SDK initialization fails.

Official quickstart order confirmed:

1. Keep Sample audio selected.
2. Click Connect avatar.
3. Initialize AvatarKit in Direct Mode with `audioFormat.channelCount = 1` and `audioFormat.sampleRate = 16000`.
4. Set the short-lived Session Token.
5. Load the Avatar ID.
6. Create `AvatarView`.
7. Initialize the controller audio context.
8. Start the controller and wait for the animation channel to connect.
9. Download bundled `quickstart_voice.pcm`.
10. Send it with `controller.send(audioData, true)`.

Current AvaCoach adaptation:

- We do not expose `VITE_SPATIUS_SESSION_TOKEN` in the frontend.
- The frontend calls `/api/spatius/session-token` when Connect Avatar is clicked.
- The backend uses `SPATIUS_API_KEY` to mint a short-lived Session Token.
- If token creation returns fallback, `AvatarStage` shows Token Fallback and keeps the placeholder.
- Realtime conversation, browser microphone, OpenAI Realtime, and Gemini Live are not part of this phase.
- TTS audio is now sent to AvatarKit when backend TTS returns usable audio and the avatar runtime is connected. The bundled sample PCM remains as an SDK validation tool.

State mapping:

- `not_configured`: missing `VITE_SPATIUS_APP_ID` or `VITE_SPATIUS_AVATAR_ID`.
- `token_loading`: requesting backend session token.
- `token_fallback`: backend token endpoint returned fallback.
- `sdk_loading`: initializing AvatarKit.
- `sdk_ready`: `AvatarSDK.initialize(...)` succeeded and the short-lived token is being applied.
- `avatar_loading`: avatar assets are being requested.
- `avatar_loaded`: `AvatarManager.shared.load(avatarId)` succeeded.
- `render_ready`: `AvatarView.onFirstRendering` fired and the render system is ready.
- `avatar_connected`: real avatar view created and Motion Server connection ready.
- `sample_audio_sending`: bundled sample PCM audio is being sent.
- `sample_audio_playing`: sample audio was sent; avatar should speak with lip sync.
- `avatar_speech_sending`: generated interviewer TTS PCM is being sent to AvatarKit.
- `avatar_speaking`: generated interviewer TTS is driving avatar lip-sync.
- `avatar_speech_finished`: generated interviewer speech finished and the avatar is listening.
- `error`: SDK initialization or avatar loading failed.
- `placeholder`: fallback placeholder is visible.

Current frontend render initialization note:

- After token direct succeeded, the next blocker moved to frontend AvatarKit rendering.
- The observed error was `Render system not initialized`.
- The most likely cause was calling `avatarView.avatarTransform = ...` immediately after `new AvatarView(...)`.
- In `@spatius/avatarkit@1.0.0`, `AvatarView` initializes its render system asynchronously. The `avatarTransform` setter throws if `renderSystem` is still null.
- The official quickstart does not set `avatarTransform` immediately after construction, so AvaCoach now avoids that early setter and waits for `onFirstRendering` to mark `render_ready`.

Safe frontend debug has been added to the browser console under the prefix `[AvaCoach AvatarKit]`. It reports:

- App ID exists / Avatar ID exists.
- Session token received and token length only.
- Container existence, connection, width, and height.
- SDK initialize start/success/failure.
- Session token set success/failure.
- Avatar load start/success/failure.
- AvatarView create start/success/failure.
- Connection state.
- Conversation state.
- Error name/message/stack.

It never logs the complete Session Token, backend API key, auth headers, or full App ID.

React lifecycle notes:

- AvatarKit connection is triggered by a user click, not by `useEffect`, so React StrictMode double-invoking effects should not start two SDK connections.
- `runtimeRef` stores the `AvatarView` runtime across re-renders.
- Cleanup only runs when `AvatarStage` truly unmounts.
- A lifecycle bug was fixed where `AvatarStage` cleanup depended on an inline callback from `App.tsx`. Start Interview changed the callback identity, React ran the old effect cleanup, and AvatarKit was destroyed immediately after connecting.
- The fix stores `onAvatarSpeechReady` in a ref and uses an empty-dependency cleanup effect. Start Interview, Submit Answer, voice mode changes, and normal speech interruption no longer destroy the AvatarKit runtime.
- Destroy calls now include a safe reason such as `component-unmount`, `reset-demo`, `disconnect-avatar`, `reconnect`, `error-cleanup`, or `unknown`, plus a short stack trace without keys or tokens.
- Send Sample Audio remains disabled until render/connection state is ready and the runtime exists.

WASM / Vite notes:

- `@spatius/avatarkit/vite` is configured in `client/vite.config.ts`.
- Build still emits a non-blocking warning about `client/node_modules/@spatius/avatarkit/dist/avatar_core_wasm.wasm` not being found.
- The production build still emits AvatarKit WASM-related chunks.
- If browser DevTools Network shows a real `.wasm` 404 during local dev, the next step is to compare the installed package layout with the official demo's package manager layout and adjust Vite asset handling or dependency hoisting.

Current TODO:

- Add token refresh before expiration.
- Add ASR voice answer input.
- Add IT question bank and technical rubrics.
- Confirm whether the Vite plugin warning is harmless in the target deployment environment.
- Prepare production-grade SDK telemetry and error handling.

Observed build note:

- `npm run build` passes with the official package installed.
- The official package and Vite plugin should be preferred over the older `@spatialwalk/avatarkit` import path.
- Current build still reports a non-blocking AvatarKit warning about `client/node_modules/@spatius/avatarkit/dist/avatar_core_wasm.wasm` not being found. The final Vite output still includes AvatarKit WASM-related chunks, so this should be treated as a packaging/path warning to confirm with Spatius before production deployment, not a current demo blocker.
- The official demo passes `region` into `AvatarSDK.initialize`. The installed `@spatius/avatarkit@1.0.0` runtime reads `configuration.region`, but the published TypeScript `Configuration` type does not currently expose it. AvaCoach uses a narrow local type cast for this field and records the version difference here.

Token API TODO:

- If fallback continues, try `SPATIUS_REGION=ap-northeast` in case the API key belongs to that region, then restart the backend.
- If fallback mentions appId or the official Console requires app binding, try `SPATIUS_INCLUDE_APP_ID_IN_TOKEN_REQUEST=true`, then restart the backend.
- Confirm the canonical response field name for the Session Token. The current API Reference shows `sessionKey`, and AvaCoach also keeps compatibility with several token-like fields.
- Confirm the exact error meaning from the returned `errors` field if token creation still falls back.
- Confirm whether the account/API key has permission to create Direct Mode Session Tokens in the selected region.

## 7. Fallback Strategy

Fallback is not treated as an error. It is a demo stability design.

- No Spatius API key -> token fallback.
- No Avatar ID -> placeholder avatar.
- No LLM -> mock interview logic.
- No TTS -> browser speech fallback.
- No browser speech -> silent text mode.
- SDK initialization failure -> placeholder remains active.
- AvatarKit package or WASM handling issue -> placeholder remains active.

The product demo remains fully usable because the core interview flow does not depend on any single external provider.

## Sample PCM Audio Lip-Sync Debugging

The current lip-sync validation uses the official Web Direct Mode quickstart sample audio:

- File: `client/public/audio/quickstart_voice.pcm`
- Source: official `direct-mode/clients/web/quickstart/public/quickstart_voice.pcm`
- Format: PCM16 mono
- Sample rate: 16 kHz
- Current size: 102,540 bytes

Official sample mode behavior:

1. Wait for AvatarKit to initialize.
2. Load the Avatar ID.
3. Create `AvatarView`.
4. Call `avatarView.controller.initializeAudioContext()` from the user click flow.
5. Call `avatarView.controller.start()`.
6. Wait for `ConnectionState.connected`.
7. Fetch the bundled PCM file.
8. Read it with `response.arrayBuffer()`.
9. Send it once with `avatarView.controller.send(audioData, true)`.

The official sample audio path does not chunk the bundled PCM file. Chunking is used later for realtime provider audio streams, where intermediate chunks are sent with `end=false` and the final chunk is sent with `end=true`.

Important lip-sync rule:

Only audio sent through `AvatarKit` via `controller.send(...)` can drive Spatius motion and mouth sync. Browser `SpeechSynthesis`, normal `<audio>` playback, and backend TTS playback in the page do not drive the avatar unless the audio is converted to AvatarKit-compatible PCM and sent through the controller.

Current AvaCoach debug behavior:

- Logs are prefixed with `[AvaCoach AvatarKit]`.
- Sample audio fetch status is logged.
- Sample audio byte length is logged.
- The SDK still receives an `ArrayBuffer`, matching the official demo.
- A small Int16 preview of the first values is logged for format sanity, capped to 10 numbers.
- Connection state before send is logged.
- Conversation state before and after send is logged.
- `controller.start` call/success is logged.
- `controller.send` call/success is logged.
- Send chunk count is logged as `1`.
- End flag is logged as `true`.

Safety:

- No Session Token is logged.
- No API key is logged.
- No auth headers are logged.
- Full audio data is not logged.

If lip-sync does not move after send:

- Confirm `connectionStateBeforeSend` is `connected`.
- Confirm `controllerStarted` is `true`.
- Confirm sample `byteLength` is greater than `0`.
- Confirm `controller.send` returned a conversation id.
- Confirm `conversation state` enters `playing`.
- If no `playing` state appears after send, the UI shows `Sample Audio Failed` with a message that the audio was sent but AvatarKit did not enter playing state.
- Check DevTools Network for Motion Server WebSocket disconnects or asset/WASM loading errors.

Generated TTS audio must be converted into the AvatarKit-required PCM format before sending it to `controller.send(...)`. Volcano TTS already returns 16 kHz mono PCM16 and can pass through the frontend PCM path. Sending MP3/WAV/browser speech directly will not drive lip-sync.

## Interviewer TTS Lip-Sync

The product speech path now extends beyond the official fixed sample audio:

```text
interviewer replyText
-> backend /api/tts
-> frontend audio decode
-> 16 kHz mono PCM16 ArrayBuffer
-> AvatarKit controller.send(pcm, true)
-> avatar speech and lip-sync
```

Implementation boundaries:

- LLM providers remain unchanged.
- DeepSeek/OpenAI/mock interview flow remains unchanged.
- Spatius Session Token endpoint remains unchanged.
- TTS provider credentials stay on the backend.
- Frontend receives only audio bytes or fallback metadata.
- TTS providers do not provide mouth-shape data in this integration.
- Spatius AvatarKit generates avatar motion/lip-sync from the PCM audio sent through `controller.send(...)`.
- Start Interview and Submit Answer use this path for interviewer replies when backend TTS and AvatarKit are available.

Fallback behavior:

- If `/api/tts` returns audio and AvatarKit is connected, AvaCoach uses Avatar TTS Lip-Sync.
- If `/api/tts` returns fallback JSON, AvaCoach uses Browser Speech fallback.
- Browser Speech fallback does not drive avatar lip-sync.
- If browser speech is unavailable, AvaCoach remains in Silent Text Mode and the text interview continues.
- OpenAI is a runnable TTS provider.
- Volcano/Doubao V3 HTTP Chunked is a runnable TTS provider when configured. It collects `code=0` base64 audio chunks and treats `code=20000000` as the successful end event.

Audio conversion:

- If provider audio is already 16 kHz mono PCM16, pass it through as an `ArrayBuffer`.
- Otherwise decode provider audio with `AudioContext.decodeAudioData`.
- Mix to mono.
- Resample to 16 kHz.
- Convert Float32 samples to little-endian PCM16.
- Send the resulting `ArrayBuffer` to AvatarKit.

This mirrors the format of the official sample PCM path while replacing the fixed voice file with real interviewer reply text.

## 8. Risks and Lessons Learned

- SDK boundary must be clear. Spatius should be positioned as the avatar rendering/driving layer, not the LLM or business logic layer.
- Token security is important. Direct Mode needs a backend token server so API keys are never exposed.
- Audio format compatibility is likely a key integration point. The SDK documentation should be clear about accepted formats, sample rates, and streaming/non-streaming options.
- SDK state events should be mapped into product UI states so users can understand what the avatar is doing.
- Good fallback is necessary for live demos. A digital human demo should still work when credentials, network, or SDK setup are incomplete.

## References

- Spatius/SpatialReal SDK mode guide: https://docs.spatialreal.ai/guide/sdk-mode
- Spatius/SpatialReal API reference: https://docs.spatialreal.ai/api-reference/api-reference
