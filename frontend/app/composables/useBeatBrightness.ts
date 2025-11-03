// composables/useBeatBrightness.ts
import {
  ref,
  computed,
  watchEffect,
  onBeforeUnmount,
  type ShallowRef
} from "vue"

type UseBeatBrightnessOptions = {
  // ranges are fractions of the analyser frequency bins: 0..1
  bassRange: [number, number]
  midRange: [number, number]
  beatThresholdMul?: number   // how many × above env to trigger
  beatCooldownMs?: number     // min ms between beats

  // 1) adaptive normalization
  smoothingFactor?: number    // how fast smoothed bass/mid follow changes

  // 2) initial ramp
  rampDurationMs?: number     // how long to fade in visual sensitivity

  // 4) log/curve compression
  compressionGamma?: number   // < 1.0 = lifts quiet, tames peaks
}

const defaultOpts: Required<UseBeatBrightnessOptions> = {
  bassRange: [0.0, 0.12],
  midRange: [0.12, 0.5],
  beatThresholdMul: 1.3,
  beatCooldownMs: 110,
  smoothingFactor: 0.05,
  rampDurationMs: 1000,
  compressionGamma: 0.7
}

export function useBeatBrightness(
  analyserRef: ShallowRef<AnalyserNode | null>,
  opts: UseBeatBrightnessOptions
) {
  const cfg = { ...defaultOpts, ...opts }

  const bassLevel = ref(0)  // 0..1, visual bass (post-curve + ramp)
  const midLevel = ref(0)   // 0..1, visual mids
  const beatBoost = ref(0)  // extra boost on beats
  const isBeat = ref(false)

  // derived CSS filter for your DOM visualizer (can tweak)
  const imageFilter = computed(() => {
    const b = 1 + bassLevel.value * 0.4 + beatBoost.value * 0.3
    const c = 1 + midLevel.value * 0.3
    const s = 1 + beatBoost.value * 0.2
    return `brightness(${b}) contrast(${c}) saturate(${s})`
  })

  // internal state for normalization & beat tracking
  let freqArray: Uint8Array<ArrayBuffer> | null = null
  let rafId: number | null = null

  let smoothedBass = 0
  let smoothedMid = 0
  let beatEnv = 0
  let lastBeatTime = 0
  let startTs: number | null = null

  const EPS = 1e-4

  const stopLoop = () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
  }

  const loop = () => {
    const analyser = analyserRef.value
    if (!analyser || !freqArray) {
      rafId = requestAnimationFrame(loop)
      return
    }

    analyser.getByteFrequencyData(freqArray)
    const n = analyser.frequencyBinCount
    if (n === 0) {
      rafId = requestAnimationFrame(loop)
      return
    }

    // --- compute band energies ---
    const [bassStartFrac, bassEndFrac] = cfg.bassRange
    const [midStartFrac, midEndFrac] = cfg.midRange

    const bassStart = Math.max(0, Math.floor(bassStartFrac * n))
    const bassEnd = Math.max(bassStart + 1, Math.floor(bassEndFrac * n))
    const midStart = Math.max(0, Math.floor(midStartFrac * n))
    const midEnd = Math.max(midStart + 1, Math.floor(midEndFrac * n))

    let bassSum = 0
    let bassCount = 0
    for (let i = bassStart; i < bassEnd; i++) {
      const v = freqArray[i]
      if (v) {
        bassSum += v
        bassCount++
      }
    }

    let midSum = 0
    let midCount = 0
    for (let i = midStart; i < midEnd; i++) {
      const v = freqArray[i]
      if (v) {
        midSum += v
        midCount++
      }
    }

    const bassAvg = bassCount ? bassSum / bassCount : 0
    const midAvg = midCount ? midSum / midCount : 0

    // raw 0..1 normalized energy
    const bassNorm = bassAvg / 255
    const midNorm = midAvg / 255

    const now = performance.now()

    // 2) initial ramp: fade in visual sensitivity in first X ms
    if (startTs === null && (bassNorm > 0.001 || midNorm > 0.001)) {
      startTs = now
    }
    const ramp =
      startTs === null
        ? 0
        : Math.min(1, (now - startTs) / cfg.rampDurationMs)

    // 1) adaptive normalization: smoothed baseline over time
    if (smoothedBass === 0 && smoothedMid === 0) {
      smoothedBass = bassNorm
      smoothedMid = midNorm
      beatEnv = (bassNorm + midNorm) / 2
    }

    smoothedBass += (bassNorm - smoothedBass) * cfg.smoothingFactor
    smoothedMid += (midNorm - smoothedMid) * cfg.smoothingFactor

    const bassRel =
      smoothedBass > EPS ? bassNorm / (smoothedBass + EPS) : 1
    const midRel =
      smoothedMid > EPS ? midNorm / (smoothedMid + EPS) : 1

    // 4) log-ish compression curve on visible levels
    const gamma = cfg.compressionGamma
    const visualBassRaw = Math.pow(Math.max(0, bassNorm), gamma)
    const visualMidRaw = Math.pow(Math.max(0, midNorm), gamma)

    const visualBass = Math.min(1, visualBassRaw * ramp)
    const visualMid = Math.min(1, visualMidRaw * ramp)

    bassLevel.value = visualBass
    midLevel.value = visualMid

    // --- beat logic (relative to env) ---
    const combined = bassRel * 0.7 + midRel * 0.3

    if (beatEnv === 0) {
      beatEnv = combined
    } else {
      beatEnv += (combined - beatEnv) * 0.1 // envelope smoothing
    }

    const sinceLastBeat = now - lastBeatTime
    const thresholdFactor = cfg.beatThresholdMul
    const target = beatEnv * thresholdFactor

    const beatNow =
      combined > target && sinceLastBeat > cfg.beatCooldownMs

    if (beatNow) {
      lastBeatTime = now
      isBeat.value = true
      beatBoost.value = Math.max(beatBoost.value, combined - beatEnv)
    } else {
      isBeat.value = false
      // decay beat boost over time
      beatBoost.value *= 0.9
      if (beatBoost.value < 0.001) beatBoost.value = 0
    }

    rafId = requestAnimationFrame(loop)
  }

  // start/stop RAF when analyser appears/disappears
  watchEffect(() => {
    const analyser = analyserRef.value
    if (analyser) {
      if (!freqArray || freqArray.length !== analyser.frequencyBinCount) {
        freqArray = new Uint8Array(analyser.frequencyBinCount)
      }
      if (rafId === null) {
        rafId = requestAnimationFrame(loop)
      }
    } else {
      stopLoop()
      freqArray = null
    }
  })

  onBeforeUnmount(() => {
    stopLoop()
  })

  return {
    bassLevel,
    midLevel,
    beatBoost,
    isBeat,
    imageFilter
  }
}
