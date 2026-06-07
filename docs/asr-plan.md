# ASR Plan — 状态：✅ Streaming ASR 已接入并通过测试

## Role In AvaCoach

ASR 是候选人语音回答输入层。它将用户语音转为文本，填入回答框，用户仍可编辑后手动提交。

```
浏览器麦克风 (PCM16 / 16kHz / mono)
→ WebSocket → 后端 /api/asr/stream
→ 火山 bigmodel_async (自定义二进制协议)
→ partial transcript (实时显示)
→ final transcript (停止后确认)
→ 填入 answer textarea
→ 用户编辑 → Submit Answer
```

## Current Implementation: Volcano Streaming ASR ✅

### 架构

- **前端**: `audioRecorder.ts` (ScriptProcessorNode PCM16 采集) → `streamingAsrClient.ts` (WebSocket 发送)
- **代理**: Vite dev proxy `ws: true` → 或直连 `ws://localhost:3001/api/asr/stream`
- **后端**: `asrStream.ts` (WebSocket Server, 诊断日志) → `volcanoStreamingAsrClient.ts` (二进制协议)
- **协议**: 火山自定义 binary protocol v1 (4B header + gzipped JSON payload)
- **模型**: bigmodel_async (流式 partial + final)

### 音频格式

```
格式: PCM16
采样率: 16000 Hz
声道: mono
字节序: little-endian
采集间隔: ~256ms (ScriptProcessorNode bufferSize=4096)
```

### 前端诊断 (dev only)

开发模式下 (`import.meta.env.DEV`)，录音结束后自动输出：
- `pcmChunkCount` / `pcmBytesTotal`
- `estimatedDurationSec` / `rmsLevel` / `peakLevel` / `silenceRatio`
- `first10SampleValues`
- 可调用 `downloadLastAsrPcm()` 下载 WAV 文件做离线对比

### 后端诊断 (ASR_STREAM_DEBUG=true)

```
connectId, frontAudioChunkCount, frontAudioBytesTotal,
firstChunkBytes, lastChunkBytes, receivedStop,
volcanoWsReady, volcanoAudioChunkCount,
partialCount, finalReceived, finalTranscriptLength, fallbackReason
```

绝不输出：API Key、完整音频、完整 transcript、raw hex。

### 测试脚本

```bash
node scripts/test-asr-stream.mjs                    # 440Hz sine wave
node scripts/test-asr-stream.mjs ./test-speech.wav  # 真实 WAV 文件
```

### 测试结果 (15s 中文语音 WAV)

| Metric | Value |
|--------|-------|
| Audio chunks sent | 375 |
| Partial transcripts | 23 |
| Final transcript | ✅ 完整中文识别 |
| Ready event | ✅ |
| Final event | ✅ |
| WebSocket close | ✅ clean |

## Provider Modes

```bash
ASR_PROVIDER=volcano_stream  # 火山流式 ASR（当前默认推荐）
ASR_PROVIDER=browser         # 浏览器 SpeechRecognition
ASR_PROVIDER=mock            # 后端 mock fallback
```

## Environment Variables

```bash
ASR_PROVIDER=volcano_stream
VOLCANO_ASR_ENABLED=true
VOLCANO_ASR_API_KEY=
VOLCANO_ASR_RESOURCE_ID=volc.seedasr.sauc.duration
VOLCANO_ASR_ENDPOINT=wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_async
VOLCANO_ASR_LANGUAGE=zh-CN
VOLCANO_ASR_AUDIO_FORMAT=pcm
VOLCANO_ASR_SAMPLE_RATE=16000
VOLCANO_ASR_BITS=16
VOLCANO_ASR_CHANNEL=1
ASR_STREAM_DEBUG=false
```

ASR 凭证仅在 `server/.env`，绝不暴露到前端。

## Fallback Strategy

```
没有麦克风权限      → 浏览器 SpeechRecognition 或手动输入
WebSocket 未连接    → 自动 fallback 到 browser ASR
火山 ASR 不可用     → fallback JSON → browser ASR
Final 为空          → 保留最后一个 partial 作为结果
超时无 Final        → 15s 超时保护，自动 fallback
Partial 有内容      → 不会被 browser ASR fallback 覆盖
```

## Protocol Notes

火山 bigmodel_async 协议要点：
- 流式响应 (`flags & 0b0001`): `[4B header][4B seq][4B size][payload]`
- 标准响应 (`flags=0`): `[4B header][4B size][payload]`
- 空 final result: 火山返回 `0x00` + `FLAG_FINAL` → 视为合法空 final
- Gzip 压缩/解压: client request payload 和 server response payload 均使用 gzip
