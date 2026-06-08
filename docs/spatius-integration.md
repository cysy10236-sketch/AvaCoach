# Spatius Integration

## Why Direct Mode

AvaCoach 使用 Spatius AvatarKit Direct Mode，因为它适合浏览器端真实数字人渲染，同时允许后端安全签发短期 Session Token。API Key 不进入前端，前端只拿到可用于 SDK 初始化的短期 token。

## Role in AvaCoach

Spatius 负责：

- Avatar rendering。
- Motion server connection。
- 接收 PCM16 音频。
- 驱动数字人口型同步。

Spatius 不负责：

- LLM 问题生成。
- TTS 语音合成。
- ASR 语音识别。
- 题库评分。

整体链路：

```text
User Answer -> ASR/Text -> LLM/Question Bank -> replyText
replyText -> Volcano TTS -> 16k mono PCM16 -> AvatarKit controller.send -> Digital Human Lip-sync
```

## Current Status

已完成：

- Backend Session Token endpoint。
- Session Token direct 成功。
- AvatarKit Web SDK 已接入。
- Connect Avatar 可加载真实 Avatar。
- Avatar render ready。
- 官方 sample PCM 可验证 SDK。
- Volcano TTS PCM 可送入 AvatarKit。
- Start Interview / Submit Answer 的面试官回复可驱动数字人口型。
- Avatar placeholder fallback 保留。

## Credentials

Backend-only:

```bash
SPATIUS_API_KEY=
SPATIUS_APP_ID=
SPATIUS_REGION=us-west
SPATIUS_TOKEN_EXPIRE_MINUTES=30
```

Frontend public config:

```bash
VITE_SPATIUS_APP_ID=
VITE_SPATIUS_AVATAR_ID=
```

更换数字人形象：

1. 在 Spatius 角色库复制新的 avatar-id。
2. 修改 `client/.env` 中的 `VITE_SPATIUS_AVATAR_ID`。
3. 重启 `npm run dev`。

不要把真实 Avatar ID 写进 README 或 docs。

## Session Token API

`GET /api/spatius/session-token`

成功：

```json
{
  "sessionToken": "...",
  "expireAt": 1710000000,
  "mode": "direct",
  "fallback": false
}
```

Fallback：

```json
{
  "sessionToken": null,
  "expireAt": null,
  "mode": "fallback",
  "fallback": true,
  "message": "SPATIUS_API_KEY is not configured. AvaCoach is running in fallback demo mode."
}
```

安全要求：

- 不返回 `SPATIUS_API_KEY`。
- 不打印完整 sessionToken。
- 不把 Authorization / X-Api-Key header 暴露给前端。

## AvatarKit Runtime Notes

- AvatarStage 应稳定 mounted。
- 普通 Start Interview / Submit Answer 不应 destroy Avatar runtime。
- Reset Demo 或真正 unmount 才允许清理 runtime。
- 重复 Connect Avatar 应幂等：已 connected 时复用 runtime。
- Send Sample Audio 只在 render ready / connected 后启用。

## Sample PCM Audio Lip-sync Debugging

- 官方 sample PCM 只用于 SDK 验证。
- 只有 AvatarKit `controller.send()` 的音频会驱动嘴型。
- Browser SpeechSynthesis / 普通 audio 播放不会驱动 Spatius motion。
- PCM 格式、sample rate、chunk send、connection state 都会影响 lip-sync。
- 当前最终产品链路使用 Volcano TTS 的 16kHz / mono / PCM16 输出。

## Fallback Strategy

- Token 失败 -> fallback demo still usable。
- SDK 初始化失败 -> placeholder mode。
- Avatar render 失败 -> text interview remains usable。
- Motion server disconnected -> Avatar speech fallback，不销毁整体面试流程。

## Known Warnings

- AvatarKit WASM / chunk size warning 是已知非阻塞 warning。
- 当前 build passes。
