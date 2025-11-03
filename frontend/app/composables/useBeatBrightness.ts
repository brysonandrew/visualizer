import { ref, computed, onBeforeUnmount, watch, type Ref } from 'vue'

type Options = {
  bassRange?: [number, number]     // fraction of spectrum [0..1]
  midRange?: [number, number]
  levelSmoothing?: number          // 0..1 smoothing
  beatThresholdMul?: number        // beat sensitivity multiplier
  beatCooldownMs?: number          // ms between beats
  beatDecay?: number               // 0..1 decay for beatBoost
}

/**
 * Reactive audio visualizer composable
 * Splits bass vs mids, smooths energy, and detects beats.
 */
export function useBeatBrightness(
  analyserRef: Ref<AnalyserNode | null>,
  opts: Options = {}
) {
  const {
    bassRange = [0.0, 0.12],
    midRange = [0.12, 0.5],
    levelSmoothing = 0.15,
    beatThresholdMul = 1.4,
    beatCooldownMs = 120,
    beatDecay = 0.9,
  } = opts

  const bassLevel = ref(0)
  const midLevel = ref(0)
  const beatBoost = ref(0)
  const isBeat = ref(false)

  const rafId = ref<number | null>(null)
  let dataArray: Uint8Array<ArrayBuffer> | null = null

  // rolling average for beat detection
  let bassRunningAvg = 0
  let lastBeatTime = 0

  const loop = () => {
    const analyser = analyserRef.value
    if (!analyser) {
      rafId.value = null
      return
    }

    // ensure we have a valid buffer
    if (
      !dataArray ||
      dataArray.length !== analyser.frequencyBinCount
    ) {
      dataArray = new Uint8Array(
        analyser.frequencyBinCount
      ) as Uint8Array<ArrayBuffer>
    }

    // guard: if still null or empty, skip frame
    if (!dataArray || dataArray.length === 0) {
      rafId.value = requestAnimationFrame(loop)
      return
    }

    analyser.getByteFrequencyData(dataArray)

    const bins = dataArray.length

    // --- helper: safely average a frequency band ---
    const avgBand = (range: [number, number]) => {
      const [startFrac, endFrac] = range
      let start = Math.floor(startFrac * bins)
      let end = Math.floor(endFrac * bins)
      if (end <= start) end = start + 1
      start = Math.max(0, start)
      end = Math.min(bins, end)

      let sum = 0
      let count = 0

      for (let i = start; i < end; i++) {
        if (!dataArray) continue // ✅ guard for TS + runtime
        const value = i < dataArray.length ? dataArray[i] ?? 0 : 0
        sum += value
        count++
      }

      return count > 0 ? sum / count : 0
    }

    // --- compute band averages ---
    const bassAvg = avgBand(bassRange)
    const midAvg = avgBand(midRange)

    // normalize + curve
    const bassRaw = bassAvg / 255
    const midRaw = midAvg / 255
    const bassTarget = Math.pow(bassRaw, 1.5)
    const midTarget = Math.pow(midRaw, 1.2)

    // smooth levels
    bassLevel.value += (bassTarget - bassLevel.value) * levelSmoothing
    midLevel.value += (midTarget - midLevel.value) * levelSmoothing

    // update rolling average for beat detection
    const avgSmooth = 0.02
    bassRunningAvg += (bassTarget - bassRunningAvg) * avgSmooth

    // --- beat detection ---
    const now = performance.now()
    const threshold = bassRunningAvg * beatThresholdMul
    const hit =
      bassTarget > threshold && now - lastBeatTime > beatCooldownMs

    if (hit) {
      lastBeatTime = now
      beatBoost.value = 1
      isBeat.value = true
    } else {
      isBeat.value = false
      beatBoost.value *= beatDecay
      if (beatBoost.value < 0.01) beatBoost.value = 0
    }

    rafId.value = requestAnimationFrame(loop)
  }

  const start = () => {
    if (!analyserRef.value || rafId.value != null) return
    lastBeatTime = performance.now()
    rafId.value = requestAnimationFrame(loop)
  }

  const stop = () => {
    if (rafId.value != null) {
      cancelAnimationFrame(rafId.value)
      rafId.value = null
    }
  }

  // auto start/stop with analyser
  watch(
    analyserRef,
    (a) => {
      if (a) start()
      else stop()
    },
    { immediate: true }
  )

  onBeforeUnmount(stop)

  // --- map levels to CSS filter ---
  const imageFilter = computed(() => {
    const baseBrightness = 1
    const baseContrast = 1

    // bass → brightness
    const bassBright = 0.7
    const beatBright = 0.8

    // mids → contrast
    const midContrast = 0.4
    const beatContrast = 0.4

    const b =
      baseBrightness +
      bassLevel.value * bassBright +
      beatBoost.value * beatBright

    const c =
      baseContrast +
      midLevel.value * midContrast +
      beatBoost.value * beatContrast

    return `brightness(${b}) contrast(${c})`
  })

  return {
    bassLevel,
    midLevel,
    beatBoost,
    isBeat,
    imageFilter,
    start,
    stop,
  }
}