export interface AudioRecorderSession {
  stop: () => Promise<Blob>
  cancel: () => void
}

export interface StreamingAudioRecorderSession {
  stop: () => Promise<void>
  cancel: () => void
}

const TARGET_SAMPLE_RATE = 16000

export function isAudioRecordingSupported(): boolean {
  return Boolean(getMediaDevices()?.getUserMedia && getAudioContextConstructor())
}

export async function createAudioRecorder(): Promise<AudioRecorderSession> {
  const chunks: ArrayBuffer[] = []
  const session = await createStreamingAudioRecorder((chunk) => {
    chunks.push(chunk)
  })

  return {
    stop: async () => {
      await session.stop()
      return new Blob(chunks, { type: 'application/octet-stream' })
    },
    cancel: session.cancel,
  }
}

export async function createStreamingAudioRecorder(
  onChunk: (chunk: ArrayBuffer) => void,
): Promise<StreamingAudioRecorderSession> {
  const mediaDevices = getMediaDevices()

  if (!mediaDevices?.getUserMedia) {
    throw new Error('麦克风权限不可用，请手动输入回答。')
  }

  const AudioContextCtor = getAudioContextConstructor()

  if (!AudioContextCtor) {
    throw new Error('当前浏览器不支持 AudioContext，请手动输入回答。')
  }

  const stream = await mediaDevices.getUserMedia({ audio: true })
  const audioContext = new AudioContextCtor()
  const source = audioContext.createMediaStreamSource(stream)
  const processor = audioContext.createScriptProcessor(4096, 1, 1)
  let stopped = false

  // 静音节点：保持音频图活跃以触发 onaudioprocess，但不将麦克风输出到扬声器
  const silentGain = audioContext.createGain()
  silentGain.gain.value = 0

  processor.onaudioprocess = (event) => {
    if (stopped) {
      return
    }

    const pcm16 = float32ToPcm16(
      event.inputBuffer.getChannelData(0),
      audioContext.sampleRate,
    )

    // 丢弃空 chunk（某些浏览器在静音时会发送零长度缓冲）
    if (pcm16.byteLength === 0) {
      return
    }

    onChunk(pcm16)
  }

  source.connect(processor)
  processor.connect(silentGain)
  silentGain.connect(audioContext.destination)

  return {
    stop: async () => {
      stopped = true
      disconnect(source, processor, silentGain)
      stopTracks(stream)
      await audioContext.close()
    },
    cancel: () => {
      stopped = true
      disconnect(source, processor, silentGain)
      stopTracks(stream)
      void audioContext.close()
    },
  }
}

function disconnect(...nodes: AudioNode[]) {
  for (const node of nodes) {
    try {
      node.disconnect()
    } catch {
      // The browser may already have torn down the graph.
    }
  }
}

function stopTracks(stream: MediaStream) {
  stream.getTracks().forEach((track) => track.stop())
}

function getAudioContextConstructor(): typeof AudioContext | undefined {
  return (globalThis as unknown as { AudioContext?: typeof AudioContext }).AudioContext
}

function getMediaDevices(): MediaDevices | undefined {
  return (globalThis as unknown as { navigator?: { mediaDevices?: MediaDevices } })
    .navigator?.mediaDevices
}

function float32ToPcm16(input: Float32Array, sourceSampleRate: number): ArrayBuffer {
  const resampled = resampleFloat32(input, sourceSampleRate, TARGET_SAMPLE_RATE)
  const pcm = new Int16Array(resampled.length)

  for (let index = 0; index < resampled.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, resampled[index]))
    pcm[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff
  }

  return pcm.buffer
}

function resampleFloat32(
  input: Float32Array,
  sourceSampleRate: number,
  targetSampleRate: number,
): Float32Array {
  if (sourceSampleRate === targetSampleRate) {
    return new Float32Array(input)
  }

  const ratio = sourceSampleRate / targetSampleRate
  const outputLength = Math.max(1, Math.round(input.length / ratio))
  const output = new Float32Array(outputLength)

  for (let index = 0; index < outputLength; index += 1) {
    const sourceIndex = index * ratio
    const leftIndex = Math.floor(sourceIndex)
    const rightIndex = Math.min(leftIndex + 1, input.length - 1)
    const weight = sourceIndex - leftIndex

    output[index] = input[leftIndex] * (1 - weight) + input[rightIndex] * weight
  }

  return output
}
