<script setup lang="ts">
import { toRef, type CSSProperties } from "vue"

const props = defineProps<{
  background: string | null
  imageFilter: string
  isBeat: boolean
  bassLevel: number
  midLevel: number
  beatBoost: number
}>()

// Wrap props into Refs so composables can consume them
const bassLevelRef = toRef(props, "bassLevel")
const midLevelRef = toRef(props, "midLevel")
const beatBoostRef = toRef(props, "beatBoost")

// 🌌 Edge glow: bass-heavy ring
const { edgeIntensity, edgeGlowStyle } = useEdgeGlow(
  bassLevelRef,
  midLevelRef,
  beatBoostRef,
  {
    color: { r: 227, g: 165, b: 58 },
    bassWeight: 0.6,
    midWeight: 0.2,
    beatWeight: 1.0
  }
)

// ✨ Center glow: mid-driven core
const { centerIntensity, centerGlowStyle } = useCenterGlow(
  bassLevelRef,
  midLevelRef,
  beatBoostRef,
  {
    color: { r: 227, g: 165, b: 58 },
    midWeight: 0.9,
    bassWeight: 0.15,
    beatWeight: 0.7,
    innerRadiusStop: 0.0,
    outerRadiusStop: 0.6
  }
)

// 🧱 Grain overlay: mostly mids + a bit of bass + beats
const { grainOpacity, grainStyle } = useGrainOverlay(
  bassLevelRef,
  midLevelRef,
  beatBoostRef,
  {
    baseOpacity: 0.05,
    maxOpacity: 0.4,
    midWeight: 0.8,
    bassWeight: 0.2,
    beatWeight: 0.7
  }
)
</script>

<template>
  <div class="relative w-full h-full overflow-hidden">
    <!-- 🖼 Base image -->
    <img
      v-if="background"
      class="absolute inset-0 w-full h-full object-cover z-0"
      :style="{
        filter: imageFilter,
        transform: isBeat
          ? `scale(1.03) rotate(${(midLevel * 2).toFixed(2)}deg)`
          : `scale(1.0) rotate(${(midLevel * 1.5).toFixed(2)}deg)`
      }"
      :src="background"
      alt="background"
    />

    <!-- ✨ Center glow overlay (mid-driven core) -->
    <div
      v-if="background"
      class="absolute inset-0 pointer-events-none mix-blend-screen transition-opacity duration-75 z-10"
      :style="centerGlowStyle"
    ></div>

    <!-- 🌌 Edge glow overlay (bass-heavy ring) -->
    <div
      v-if="background"
      class="absolute inset-0 pointer-events-none mix-blend-screen transition-opacity duration-75 z-10"
      :style="edgeGlowStyle"
    ></div>

    <!-- 🧱 Grain overlay (texture, mostly mids) -->
    <div
      v-if="background"
      class="absolute inset-0 noise-overlay transition-opacity duration-75 z-10"
      :style="grainStyle"
    ></div>

    <!-- 🧠 Debug HUD (DOM-only metrics) -->
    <div
      class="absolute bottom-4 left-4 text-xs bg-black/60 px-3 py-2 rounded z-20"
    >
      <div>bass: {{ bassLevel.toFixed(2) }}</div>
      <div>mids: {{ midLevel.toFixed(2) }}</div>
      <div>beatBoost: {{ beatBoost.toFixed(2) }}</div>
      <div>edgeIntensity: {{ edgeIntensity.toFixed(2) }}</div>
      <div>centerIntensity: {{ centerIntensity.toFixed(2) }}</div>
      <div>grainOpacity: {{ grainOpacity.toFixed(2) }}</div>
      <div>isBeat: {{ isBeat ? "yes" : "no" }}</div>
    </div>
  </div>
</template>