// composables/useAudioVisualizer.ts
import { ref, shallowRef, onBeforeUnmount, computed } from "vue"

export type FrameCallback = (opts: {
  analyser: AnalyserNode
  freq: Uint8Array<ArrayBuffer>
  time: Float32Array<ArrayBuffer> | null
}) => void

// flip this to true if you ever actually use time-domain data
const CAPTURE_TIME_DOMAIN = false

export function useAudioVisualizer() {
  const notification = useNotification()

  const isClient = typeof window !== "undefined"
  const isPlaying = ref(false)
  const hasBuffer = ref(false)

  // Web Audio pieces
  const audioCtx = shallowRef<AudioContext | null>(null)
  const analyser = shallowRef<AnalyserNode | null>(null)
  const gain = shallowRef<GainNode | null>(null)
  const source = shallowRef<AudioBufferSourceNode | null>(null)
  const buffer = shallowRef<AudioBuffer | null>(null)

  // playback state
  const startTime = ref(0) // when current play() began (ctx time)
  const pauseOffset = ref(0) // seconds into buffer when paused/stopped

  // analyser data buffers (reused each frame)
  const freq = shallowRef<Uint8Array | null>(null)
  const time = shallowRef<Float32Array<ArrayBuffer> | null>(null)

  const level = ref(0) // 0..1 smoothed intensity (spare hook if you want it)

  // RAF loop
  let rafId: number | null = null
  const frameHandlers = new Set<FrameCallback>()

  function ensureCtx() {
    if (!isClient) return
    if (!audioCtx.value) {
      audioCtx.value = new AudioContext()
      gain.value = audioCtx.value.createGain()
      analyser.value = audioCtx.value.createAnalyser()

      // 🔧 slightly cheaper + still detailed enough for visuals
      analyser.value.fftSize = 1024 // was 2048
      analyser.value.smoothingTimeConstant = 0.8
      analyser.value.minDecibels = -85
      analyser.value.maxDecibels = -10

      // default chain: (source) -> analyser -> gain -> destination
      analyser.value.connect(gain.value)
      gain.value.connect(audioCtx.value.destination)

      // allocate analyser arrays once
      const f = new Uint8Array(analyser.value.frequencyBinCount)
      freq.value = f

      if (CAPTURE_TIME_DOMAIN) {
        const t = new Float32Array(analyser.value.fftSize)
        time.value = t
      } else {
        time.value = null
      }
    }
  }

  async function loadFile(file: File) {
    ensureCtx()
    if (!audioCtx.value) return

    const bytes = await file.arrayBuffer()
    buffer.value = await audioCtx.value.decodeAudioData(bytes)
    hasBuffer.value = true
    pauseOffset.value = 0
  }

  function makeSource() {
    if (!audioCtx.value || !buffer.value || !analyser.value) return
    // disconnect previous source if any
    if (source.value) {
      try {
        source.value.disconnect()
      } catch {}
      try {
        source.value.stop()
      } catch {}
    }
    const s = audioCtx.value.createBufferSource()
    s.buffer = buffer.value
    s.connect(analyser.value)
    source.value = s
  }

  async function play() {
    ensureCtx()
    if (!audioCtx.value || !buffer.value || !analyser.value) return
    if (audioCtx.value.state === "suspended") {
      await audioCtx.value.resume()
    }
    makeSource()
    if (!source.value) {
      notification.error({ title: "Error", message: "No source." })
      return
    }

    startTime.value = audioCtx.value.currentTime - pauseOffset.value
    source.value.start(0, pauseOffset.value)
    isPlaying.value = true

    startRAF()
    source.value.onended = () => {
      // If it ended naturally, reset flags (unless we paused/stopped)
      if (!isPlaying.value) return
      isPlaying.value = false
      pauseOffset.value = 0
      stopRAF()
    }
  }

  function pause() {
    if (!audioCtx.value || !source.value) return
    const elapsed = audioCtx.value.currentTime - startTime.value
    pauseOffset.value = Math.min(
      elapsed,
      buffer.value ? buffer.value.duration : elapsed
    )
    try {
      source.value.stop()
    } catch {}
    isPlaying.value = false
    stopRAF()
  }

  function stop() {
    if (!audioCtx.value) return
    if (source.value) {
      try {
        source.value.stop()
      } catch {}
    }
    isPlaying.value = false
    pauseOffset.value = 0
    stopRAF()
  }

  function toggle() {
    if (isPlaying.value) pause()
    else void play()
  }

  function setGain(vol: number) {
    if (gain.value) gain.value.gain.value = vol
  }

  function onFrame(cb: FrameCallback) {
    frameHandlers.add(cb)
    return () => frameHandlers.delete(cb)
  }

  function startRAF() {
    if (!analyser.value || rafId !== null || !freq.value) {
      // just bail; no need to spam notifications
      return
    }
    const a = analyser.value
    const f = freq.value as Uint8Array<ArrayBuffer>
    const t = (time.value ?? null) as Float32Array<ArrayBuffer> | null

    const loop = () => {
      a.getByteFrequencyData(f)
      if (CAPTURE_TIME_DOMAIN && t && time.value) {
        a.getFloatTimeDomainData(time.value)
      }

      frameHandlers.forEach((cb) => cb({ analyser: a, freq: f, time: t }))
      rafId = requestAnimationFrame(loop)
    }
    rafId = requestAnimationFrame(loop)
  }

  function stopRAF() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
  }

  onBeforeUnmount(() => {
    stop()
    if (audioCtx.value) {
      audioCtx.value.close()
    }
  })

  return {
    // state
    isPlaying,
    hasBuffer,
    duration: computed(() => buffer.value?.duration ?? 0),
    position: computed(() => {
      if (!audioCtx.value) return 0
      return isPlaying.value
        ? audioCtx.value.currentTime - startTime.value
        : pauseOffset.value
    }),

    // nodes / arrays
    audioCtx,
    analyser,
    freq,
    time,

    // controls
    loadFile,
    play,
    pause,
    stop,
    toggle,
    setGain,

    // per-frame hook
    onFrame,

    // for recorder / routing
    outputNode: gain
  }
}