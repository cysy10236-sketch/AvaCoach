# TTS Integration

## Role in AvaCoach

TTS 负责把 interviewer replyText 转换成语音。成功路径下，TTS 音频会被送入 Spatius AvatarKit，让数字人真正“说出”面试官问题、追问和简短报告提示，并完成口型同步。

## Current Status

已完成：

- Volcano TTS V3 HTTP Chunked integration。
- 解析 chunked JSON events。
- 收集 `code=0` 的 base64 音频片段。
- 正确识别 `code=20000000` 为成功结束事件。
- 输出 `audio/pcm; rate=16000; channels=1; encoding=signed-integer; bits=16`。
- 前端将 PCM16 送入 AvatarKit `controller.send()`。
- Start Interview / Submit Answer 的面试官回复可驱动数字人口型。
- End Interview 报告提示可走同一语音链路。
- Browser Speech / Silent Text fallback 保留。

## Runtime Flow

```mermaid
flowchart LR
  TEXT["interviewer replyText"] --> API["POST /api/tts"]
  API --> VTTS["Volcano TTS V3<br/>HTTP Chunked"]
  VTTS --> PCM["16kHz mono PCM16"]
  PCM --> FE["Frontend Speech Player"]
  FE --> AV["AvatarKit controller.send"]
  AV --> FACE["Digital Human Lip-sync"]
```

## Important Rule

只有通过 AvatarKit `controller.send()` 发送的 PCM 音频才会驱动数字人口型。Browser SpeechSynthesis 或普通 audio 播放不能驱动 Spatius motion。

## Double-voice Fix

已修复双声音问题：

- 如果 AvatarKit `controller.send()` 成功，不再因为短时间未观察到 `conversationState=playing` 就触发 Browser Speech fallback。
- send 成功但未观察到 playing 时，状态可记录为 unconfirmed，但不会再播放第二路 browser speech。
- Browser Speech fallback 只在 TTS JSON fallback、TTS 请求失败、AvatarKit 未连接超时或 `controller.send()` 明确抛错时触发。
- 新一段语音前会 abort / cancel 上一段 fallback speech，避免 SpeechSynthesis 队列残留。

## Fallback Strategy

- Volcano TTS 成功 -> Avatar TTS Lip-Sync。
- TTS 返回 JSON fallback -> Browser Speech fallback。
- Browser Speech 不可用 -> Silent Text Mode。
- AvatarKit 未连接或 send 失败 -> Browser Speech fallback。
- 所有 fallback 都不影响文字面试流程。

## Environment Variables

只放在 `server/.env`：

```bash
TTS_PROVIDER=volcano
VOLCANO_TTS_ENABLED=true
VOLCANO_TTS_API_KEY=
VOLCANO_TTS_RESOURCE_ID=
VOLCANO_TTS_VOICE_TYPE=
VOLCANO_TTS_FORMAT=pcm
VOLCANO_TTS_SAMPLE_RATE=16000
```

不要把真实 key 写进前端、README 或 docs。

## Demo Talking Point

> LLM 负责生成面试官文本，Volcano TTS 负责生成 16k PCM 语音，Spatius AvatarKit 负责把 PCM 音频驱动成数字人口型。这三层职责是分开的。

## Current Limitations

- 当前仍是 demo/prototype。
- TTS provider 可继续扩展到更多声音、情绪和流式播放。
- 生产环境需要更完整的音频缓存、错误监控和用量控制。
