// composables/useCenterGlow.ts
import { computed, type Ref } from 'vue'

type CenterGlowOptions = {
  color?: { r: number; g: number; b: number }
  midWeight?: number
  bassWeight?: number
  beatWeight?: number
  // how wide the center glow is as a fraction of radius
  innerRadiusStop?: number
  outerRadiusStop?: number
}

export function useCenterGlow(
  bassLevel: Ref<number>,
  midLevel: Ref<number>,
  beatBoost: Ref<number>,
  options: CenterGlowOptions = {}
) {
  const {
    color = { r: 227, g: 165, b: 58 }, // Auroscuro gold
    midWeight = 0.8,
    bassWeight = 0.2,
    beatWeight = 0.9,
    innerRadiusStop = 0.0,
    outerRadiusStop = 0.7,
  } = options

  const centerIntensity = computed(() => {
    // mids = main driver, bass = subtle reinforcement
    const base =
      midLevel.value * midWeight +
      bassLevel.value * bassWeight

    const punch = beatBoost.value * beatWeight

    const raw = base + punch
    return Math.max(0, Math.min(1, raw)) // clamp 0..1
  })

  const centerGlowStyle = computed(() => {
    const intensity = centerIntensity.value

    if (!intensity) {
      return {
        opacity: 0,
      } as const
    }

    const innerAlpha = 0.8 * intensity
    const midAlpha = 0.4 * intensity

    const innerColor = `rgba(${color.r}, ${color.g}, ${color.b}, ${innerAlpha})`
    const midColor = `rgba(${color.r}, ${color.g}, ${color.b}, ${midAlpha})`

    // Center hot → fade out → edges transparent
    const backgroundImage = `
      radial-gradient(
        circle at center,
        ${innerColor} ${innerRadiusStop * 100}%,
        ${midColor} ${outerRadiusStop * 100}%,
        transparent 100%
      )
    `

    return {
      backgroundImage,
      opacity: intensity,
    } as const
  })

  return {
    centerIntensity,
    centerGlowStyle,
  }
}