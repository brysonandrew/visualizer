// composables/useGrainOverlay.ts
import { computed, type Ref } from 'vue'

type GrainOptions = {
  baseOpacity?: number   // always-on minimal grain
  maxOpacity?: number    // hard cap
  midWeight?: number     // how much mids drive grain
  bassWeight?: number    // how much bass drives grain
  beatWeight?: number    // extra on beats
}

export function useGrainOverlay(
  bassLevel: Ref<number>,
  midLevel: Ref<number>,
  beatBoost: Ref<number>,
  options: GrainOptions = {}
) {
  const {
    baseOpacity = 0.08,
    maxOpacity = 0.45,
    midWeight = 0.8,
    bassWeight = 0.2,
    beatWeight = 0.8,
  } = options

  const grainOpacity = computed(() => {
    const tonal =
      midLevel.value * midWeight +
      bassLevel.value * bassWeight

    const punch = beatBoost.value * beatWeight

    const raw = baseOpacity + tonal + punch

    return Math.min(maxOpacity, Math.max(0, raw))
  })

  const grainStyle = computed(() => ({
    opacity: grainOpacity.value,
  } as const))

  return {
    grainOpacity,
    grainStyle,
  }
}