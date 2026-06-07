# AvaCoach Interview Checklist

## Before The Demo

- Run `npm install`.
- Check `server/.env` exists if testing real providers.
- Check `client/.env` exists only if testing real AvatarKit.
- Never commit `.env` files.
- Run `npm run build`.
- Run `npm run dev`.
- Open `http://localhost:5173`.

## No AvatarKit Config

Expected:

- Avatar area shows placeholder.
- Spatius state says not configured or placeholder.
- Interview flow remains usable.
- LLM/mock still works.
- TTS/browser/silent fallback still works.

## Partial AvatarKit Config

Example:

```bash
VITE_SPATIUS_APP_ID=...
VITE_SPATIUS_AVATAR_ID=
```

Expected:

- UI reports Avatar SDK not configured.
- Placeholder remains visible.
- Interview flow remains usable.

## Full AvatarKit Config

Client:

```bash
VITE_SPATIUS_APP_ID=...
VITE_SPATIUS_AVATAR_ID=...
```

Server:

```bash
SPATIUS_API_KEY=
SPATIUS_REGION=us-west
SPATIUS_TOKEN_EXPIRE_MINUTES=30
```

Expected:

- Frontend calls `/api/spatius/session-token`.
- Backend returns Direct Mode token if key/region are valid.
- Click Connect Avatar.
- AvatarStage initializes AvatarKit, loads the Avatar ID, initializes the controller audio context, starts the controller, and waits for Motion Server connection.
- If avatar load succeeds, real avatar appears and status says Avatar Connected.
- Click Send Sample Audio.
- Bundled PCM16 mono 16 kHz sample audio is sent with `controller.send(audioData, true)`.
- Avatar should speak with lip sync.
- If it fails, placeholder remains visible with a clear message.
- Click Start Interview.
- Avatar should remain visible after the interview starts.
- Console should not show `runtime destroy started` after Start Interview.
- If backend TTS succeeds, interviewer reply PCM is sent to AvatarKit and conversation state should enter playing.
- Submit Answer should show an AI follow-up, feedback, and another avatar speech attempt.

Lifecycle regression check:

- Connect Avatar.
- Wait for `connection state connected`.
- Click Start Interview.
- Confirm there is no immediate `connection state disconnected`.
- Confirm any destroy debug log includes a real reason such as `component-unmount`, not a normal interview state update.

## Token Test

```powershell
Invoke-WebRequest -Uri http://localhost:3001/api/spatius/session-token
```

Check:

- `mode = "direct"` means token is ready.
- `mode = "fallback"` means placeholder remains active.
- `debug.hasApiKey` and `debug.apiKeyLength` confirm whether the backend read a key without exposing it.
- `debug.endpointHost` and `debug.region` confirm the selected region host.
- `debug.requestShape.expireAtUnitGuess` should be `seconds`.
- Response must never contain `SPATIUS_API_KEY`.

## LLM Provider Test

```powershell
$body = @{ role = "frontend" } | ConvertTo-Json
Invoke-WebRequest -Uri http://localhost:3001/api/interview/start -Method Post -ContentType "application/json" -Body $body
```

Check:

- `provider = "openai"`, `source = "llm"`
- `provider = "deepseek"`, `source = "llm"`
- `provider = "mock"`, `source = "mock"`

## TTS Test

```powershell
$body = @{ text = "AvaCoach voice test." } | ConvertTo-Json
Invoke-WebRequest -Uri http://localhost:3001/api/tts -Method Post -ContentType "application/json" -Body $body
```

Expected:

- Audio response if backend TTS works.
- With Volcano configured, successful response content type should be `audio/pcm; rate=16000; channels=1; encoding=signed-integer; bits=16`.
- JSON fallback if backend TTS is unavailable.
- Browser speech or silent text mode in the UI if backend TTS fails.

Volcano PowerShell check:

```powershell
$response = Invoke-WebRequest `
  -UseBasicParsing `
  -Uri http://localhost:3001/api/tts `
  -Method Post `
  -ContentType "application/json; charset=utf-8" `
  -Body ([System.Text.Encoding]::UTF8.GetBytes('{"text":"你好，我是 AvaCoach 的数字人面试官。"}'))

$response.Headers["Content-Type"]
$response.RawContentLength
```

Expected:

- `Content-Type` is `audio/pcm; rate=16000; channels=1; encoding=signed-integer; bits=16`.
- `RawContentLength` is greater than `1000`.

## ASR Voice Answer Test

Browser demo path:

- Start the frontend with `npm run dev`.
- Open `http://localhost:5173`.
- Start an interview and wait until the digital human finishes speaking.
- Click Start Voice Answer.
- Allow microphone permission.
- Speak a short Chinese answer.
- Click Stop Recording.
- Confirm the transcript appears in the answer textarea.
- Edit the transcript manually if needed.
- Click Submit Answer.
- Confirm the existing feedback, follow-up, TTS, and AvatarKit lip-sync flow still works.

Backend skeleton test:

```powershell
$body = @{ language = "zh-CN"; mockText = "这是一个后端 ASR mock 测试。" } | ConvertTo-Json
Invoke-WebRequest -Uri http://localhost:3001/api/asr/transcribe -Method Post -ContentType "application/json" -Body $body
```

Expected:

- Mock provider can return the mock transcript.
- Without a real provider, the backend returns fallback JSON.
- No ASR key or recording file is committed to the repository.

## Current Known TODOs

- Implement real Volcano ASR after official API docs are confirmed.
- Add stronger technical rubrics.
- Add production-grade token refresh and SDK error handling.
- Prepare production deployment.
