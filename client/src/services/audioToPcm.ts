const AVATAR_SAMPLE_RATE = 16_000

export async function decodeAudioArrayBuffer(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext
  const audioContext = new AudioContextClass()

  try {
    return await audioContext.decodeAudioData(arrayBuffer.slice(0))
  } finally {
    void audioContext.close()
  }
}

export async function resampleTo16kMono(audioBuffer: AudioBuffer): Promise<Float32Array> {
  const mono = mixToMono(audioBuffer)

  if (audioBuffer.sampleRate === AVATAR_SAMPLE_RATE) {
    return mono
  }

  const outputLength = Math.max(
    1,
    Math.round((mono.length * AVATAR_SAMPLE_RATE) / audioBuffer.sampleRate),
  )
  const offlineContext = new OfflineAudioContext(1, outputLength, AVATAR_SAMPLE_RATE)
  const source = offlineContext.createBufferSource()
  const monoBuffer = offlineContext.createBuffer(1, mono.length, audioBuffer.sampleRate)

  monoBuffer.copyToChannel(new Float32Array(mono), 0)
  source.buffer = monoBuffer
  source.connect(offlineContext.destination)
  source.start(0)

  const rendered = await offlineContext.startRendering()
  return rendered.getChannelData(0)
}

export function float32ToPcm16ArrayBuffer(float32: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(float32.length * 2)
  const view = new DataView(buffer)

  for (let index = 0; index < float32.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, float32[index]))
    view.setInt16(index * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
  }

  return buffer
}

export async function convertAudioBlobToAvatarPcm(arrayBuffer: ArrayBuffer): Promise<ArrayBuffer> {
  // AvatarKit sample audio uses mono PCM16 at 16 kHz. Provider TTS usually
  // returns compressed MP3/WAV, so it must be decoded and resampled before
  // controller.send(...) can drive avatar motion and lip-sync.
  const decoded = await decodeAudioArrayBuffer(arrayBuffer)
  const mono16k = await resampleTo16kMono(decoded)

  return float32ToPcm16ArrayBuffer(mono16k)
}

export async function convertTtsAudioToAvatarPcm(
  arrayBuffer: ArrayBuffer,
  contentType: string,
): Promise<ArrayBuffer> {
  if (isRawPcmContentType(contentType)) {
    const sampleRate = readSampleRate(contentType) ?? AVATAR_SAMPLE_RATE

    if (sampleRate === AVATAR_SAMPLE_RATE) {
      return arrayBuffer
    }

    const float32 = pcm16ArrayBufferToFloat32(arrayBuffer)
    const resampled = await resampleFloat32Mono(float32, sampleRate, AVATAR_SAMPLE_RATE)
    return float32ToPcm16ArrayBuffer(resampled)
  }

  return convertAudioBlobToAvatarPcm(arrayBuffer)
}

function mixToMono(audioBuffer: AudioBuffer): Float32Array {
  const output = new Float32Array(audioBuffer.length)

  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel += 1) {
    const channelData = audioBuffer.getChannelData(channel)

    for (let index = 0; index < channelData.length; index += 1) {
      output[index] += channelData[index] / audioBuffer.numberOfChannels
    }
  }

  return output
}

function isRawPcmContentType(contentType: string): boolean {
  const normalized = contentType.toLowerCase()

  return (
    normalized.startsWith('audio/pcm') ||
    normalized.includes('audio/x-pcm') ||
    normalized.includes('application/octet-stream')
  )
}

function readSampleRate(contentType: string): number | null {
  const match = contentType.match(/(?:rate|sample_rate)=([0-9]+)/i)

  if (!match) {
    return null
  }

  const parsed = Number(match[1])
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function pcm16ArrayBufferToFloat32(arrayBuffer: ArrayBuffer): Float32Array {
  const view = new DataView(arrayBuffer)
  const output = new Float32Array(Math.floor(arrayBuffer.byteLength / 2))

  for (let index = 0; index < output.length; index += 1) {
    output[index] = view.getInt16(index * 2, true) / 0x8000
  }

  return output
}

async function resampleFloat32Mono(
  float32: Float32Array,
  inputRate: number,
  outputRate: number,
): Promise<Float32Array> {
  const outputLength = Math.max(1, Math.round((float32.length * outputRate) / inputRate))
  const offlineContext = new OfflineAudioContext(1, outputLength, outputRate)
  const source = offlineContext.createBufferSource()
  const buffer = offlineContext.createBuffer(1, float32.length, inputRate)

  buffer.copyToChannel(new Float32Array(float32), 0)
  source.buffer = buffer
  source.connect(offlineContext.destination)
  source.start(0)

  const rendered = await offlineContext.startRendering()
  return rendered.getChannelData(0)
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext
  }
}
