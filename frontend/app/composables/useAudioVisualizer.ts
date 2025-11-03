// composables/useAudioVisualizer.ts
import { ref, shallowRef, onBeforeUnmount } from "vue"

export type FrameCallback = (opts: { analyser: AnalyserNode; freq: Uint8Array; time: Float32Array }) => void

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

  // analyser data buffers (you can reuse these each frame)
  const freq = shallowRef<Uint8Array | null>(null)
  const time = shallowRef<Float32Array | null>(null)

  const level = ref(0) // 0..1 smoothed intensity

  // RAF loop
  let rafId: number | null = null
  const frameHandlers = new Set<FrameCallback>()

  function ensureCtx() {
    if (!isClient) return
    if (!audioCtx.value) {
      audioCtx.value = new AudioContext()
      gain.value = audioCtx.value.createGain()
      analyser.value = audioCtx.value.createAnalyser()
      analyser.value.fftSize = 2048

      // default chain: (source) -> analyser -> gain -> destination
      analyser.value.connect(gain.value)
      gain.value.connect(audioCtx.value.destination)

      // allocate analyser arrays
      const f = new Uint8Array(analyser.value.frequencyBinCount)
      const t = new Float32Array(analyser.value.fftSize)
      freq.value = f
      time.value = t
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
    // compute elapsed into buffer, then stop and store offset
    const elapsed = audioCtx.value.currentTime - startTime.value
    pauseOffset.value = Math.min(elapsed, buffer.value ? buffer.value.duration : elapsed)
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
    else play()
  }

  function setGain(vol: number) {
    if (gain.value) gain.value.gain.value = vol
  }

  function onFrame(cb: FrameCallback) {
    frameHandlers.add(cb)
    return () => frameHandlers.delete(cb)
  }

  function startRAF() {
    if (!analyser.value || rafId !== null || !freq.value || !time.value) {
      notification.error({ title: "Error", message: "Can't start RAF." })

      return
    }
    const a = analyser.value
    const f = freq.value as Uint8Array<ArrayBuffer>
    const t = time.value as Float32Array<ArrayBuffer>
    const loop = () => {
      // console.log(f,t)
      a.getByteFrequencyData(f)
      a.getFloatTimeDomainData(t)
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
      return isPlaying.value ? audioCtx.value.currentTime - startTime.value : pauseOffset.value
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

    outputNode: gain
  }
}
