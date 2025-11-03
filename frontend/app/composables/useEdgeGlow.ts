// composables/useEdgeGlow.ts
import { computed, type Ref } from 'vue'

type EdgeGlowOptions = {
  color?: { r: number; g: number; b: number }
  // how strongly each band contributes
  bassWeight?: number
  midWeight?: number
  beatWeight?: number
}

export function useEdgeGlow(
  bassLevel: Ref<number>,
  midLevel: Ref<number>,
  beatBoost: Ref<number>,
  options: EdgeGlowOptions = {}
) {
  const {
    color = { r: 227, g: 165, b: 58 }, // Auroscuro gold-ish
    bassWeight = 0.6,
    midWeight = 0.2,
    beatWeight = 1.0,
  } = options

  const edgeIntensity = computed(() => {
    const base =
      bassLevel.value * bassWeight +
      midLevel.value * midWeight

    const punch = beatBoost.value * beatWeight

    const raw = base + punch
    return Math.max(0, Math.min(1, raw)) // clamp 0..1
  })

  const edgeGlowStyle = computed(() => {
    const intensity = edgeIntensity.value

    if (!intensity) {
      return {
        opacity: 0,
      } as const
    }

    const innerAlpha = 0.25 * intensity
    const outerAlpha = 0.85 * intensity

    const innerColor = `rgba(${color.r}, ${color.g}, ${color.b}, ${innerAlpha})`
    const outerColor = `rgba(${color.r}, ${color.g}, ${color.b}, ${outerAlpha})`

    const backgroundImage = `
      radial-gradient(
        circle at center,
        transparent 0%,
        transparent 45%,
        ${innerColor} 65%,
        ${outerColor} 100%
      )
    `

    return {
      backgroundImage,
      opacity: intensity,
    } as const
  })

  return {
    edgeIntensity,
    edgeGlowStyle,
  }
}