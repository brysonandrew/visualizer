<script setup lang="ts">
import { computed, onMounted } from "vue"
import clsx from "clsx"

const notification = useNotification()

const { url: background, setFromFile: setBackground } = useTempUrl()
const {
  isPlaying,
  hasBuffer,
  loadFile,
  toggle: togglePlay,
  onFrame,
  analyser,
  freq
} = useAudioVisualizer()

const {
  bassLevel,
  midLevel,
  beatBoost,
  isBeat,
  imageFilter
} = useBeatBrightness(analyser, {
  bassRange: [0.0, 0.12],
  midRange: [0.12, 0.5],
  beatThresholdMul: 1.4,
  beatCooldownMs: 110
})

// 🌌 Edge glow: bass-heavy ring
const { edgeIntensity, edgeGlowStyle } = useEdgeGlow(
  bassLevel,
  midLevel,
  beatBoost,
  {
    color: { r: 227, g: 165, b: 58 },
    bassWeight: 0.6,
    midWeight: 0.2,
    beatWeight: 1.0
  }
)

// ✨ Center glow: mid-driven core
const { centerIntensity, centerGlowStyle } = useCenterGlow(
  bassLevel,
  midLevel,
  beatBoost,
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
  bassLevel,
  midLevel,
  beatBoost,
  {
    baseOpacity: 0.05,
    maxOpacity: 0.4,
    midWeight: 0.8,
    bassWeight: 0.2,
    beatWeight: 0.7
  }
)

const handleInputChange = (event: Event) => {
  const input = event.currentTarget as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  if (file.type.startsWith("audio/")) {
    loadFile(file)
  } else if (file.type.startsWith("image/")) {
    setBackground(file)
  } else {
    const message = `Unsupported file type: ${file.type}`
    notification.warning({ title: "Warning!", message })
    console.warn(message)
  }
}

const handlePlay = async () => {
  if (!hasBuffer.value) {
    notification.error({ title: "Error!", message: "No audio." })
    return
  }
  if (!background.value) {
    notification.error({ title: "Error!", message: "No background." })
    return
  }
  togglePlay()
}

useSpacebar(() => {
  notification.info({ title: "Info", message: "Spacebar pressed." })
  handlePlay()
})

onMounted(() => {
  onFrame(() => {
    if (!freq.value) return
    let sum = 0
    const bins = Math.min(32, freq.value.length)
    for (let i = 0; i < bins; i++) {
      const next = freq.value[i]
      if (next) sum += next
    }
    const bass = sum / bins
    // console.log("bass", bass)
  })
})

const isPlayDisabled = computed(
  () => !Boolean(background.value) || !hasBuffer.value
)

const sources = computed(() => {
  return [
    ["🎇 image", Boolean(background.value)],
    ["🎧 audio", hasBuffer.value]
  ] as const
})
</script>
<template>
  <ClientOnly>
    <div
      class="relative flex items-center justify-center w-screen h-screen text-white bg-black hover:bg-slate-950 select-none overflow-hidden"
    >
      <!-- 🎛️ UI / Controls (top-left) -->
      <div
        v-if="!isPlaying"
        class="flex flex-col gap-4 absolute top-4 left-4 bg-slate-800 p-2 rounded-md z-20"
      >
        <ul>
          <li
            v-for="[title, isValue] in sources"
            :class="clsx('', !isValue && 'text-slate-400')"
          >
            {{ title }} {{ isValue ? "✅" : "required" }}
          </li>
        </ul>
        <button
          :class="clsx(
            'p-1.5 bg-slate-900 cursor-pointer disabled:text-slate-400 disabled:cursor-not-allowed'
          )"
          :disabled="isPlayDisabled"
          @click="handlePlay"
        >
          ▶️ Play
        </button>
        <p>⎵ spacebar to start/stop.</p>
      </div>

      <!-- 🧠 Debug HUD -->
      <div
        v-else
        class="absolute bottom-4 left-4 text-xs bg-black/60 px-3 py-2 rounded z-20"
      >
        <div>bass: {{ bassLevel.toFixed(2) }}</div>
        <div>mids: {{ midLevel.toFixed(2) }}</div>
        <div>beatBoost: {{ beatBoost.toFixed(2) }}</div>
        <div>edgeIntensity: {{ edgeIntensity.toFixed(2) }}</div>
        <div>centerIntensity: {{ centerIntensity.toFixed(2) }}</div>
        <div>grainOpacity: {{ grainOpacity.toFixed(2) }}</div>
        <div>isBeat: {{ isBeat ? "yes" : "no" }}</div>
        <div class="opacity-50">spacebar to play/pause</div>
      </div>

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

      <!-- 📁 Idle upload prompt -->
      <div class="text-xl flex flex-col items-center gap-4 z-0">
        <div class="text-4xl">📁</div>
        <div><b>Choose</b> or <b>drag</b> 🎧 🎇 here.</div>
      </div>

      <!-- 📂 File input (click or drag) -->
      <input
        class="absolute inset-0 opacity-0 cursor-pointer"
        type="file"
        accept="image/*,audio/*"
        @change="handleInputChange"
      />
    </div>
  </ClientOnly>
</template>