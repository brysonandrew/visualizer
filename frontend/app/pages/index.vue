<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue"
import clsx from "clsx"

const notification = useNotification()

const { url: background, setFromFile: setBackground } = useTempUrl()
const isCanvasShown = ref(true)

const {
  isPlaying,
  hasBuffer,
  loadFile,
  toggle: togglePlay,
  onFrame,
  analyser,
  freq,
  audioCtx, // from useAudioVisualizer
  outputNode // master gain / final node
} = useAudioVisualizer()

// 🔊 Core audio analysis (shared by DOM + Canvas)
const { bassLevel, midLevel, beatBoost, isBeat, imageFilter } = useBeatBrightness(analyser, {
  bassRange: [0.0, 0.12],
  midRange: [0.12, 0.5],
  beatThresholdMul: 1.4,
  beatCooldownMs: 110
})

// 🎥 Canvas used for parallel visualizer (for silent recording)
const recordCanvas = ref<HTMLCanvasElement | null>(null)
const setRecordCanvas = (el: HTMLCanvasElement | null) => {
  recordCanvas.value = el
}

useCanvasVisualizer(
  recordCanvas,
  { noiseImageUrl: DEFAULT_NOISE_PATH },
  {
    backgroundUrl: background,
    bassLevel,
    midLevel,
    beatBoost,
    isBeat
  }
)
// 🎥 Silent canvas recorder
const {
  isRecording,
  startRecording,
  stopRecording,
  error: recorderError
} = useCanvasRecorder(recordCanvas, audioCtx, outputNode, {
  fps: 60,
  mimeType: "video/webm;codecs=vp9,opus",
  autoDownload: true
})

// surface recorder errors as notifications
watch(recorderError, (msg) => {
  if (msg) {
    notification.error({ title: "Recorder error", message: msg })
  }
})

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

const isPlayDisabled = computed(() => !Boolean(background.value) || !hasBuffer.value)

const sources = computed(() => {
  return [
    ["🎇 image", Boolean(background.value)],
    ["🎧 audio", hasBuffer.value]
  ] as const
})


</script>

<template>
  <ClientOnly>
    <div class="relative w-screen h-screen overflow-auto text-white bg-black hover:bg-slate-950 select-none">
      <!-- 🎛️ UI / Controls (top-left) -->
      <div class="flex flex-col gap-4 fixed top-4 left-4 bg-slate-800 p-2 rounded-md z-20">
        <ul>
          <li v-for="[title, isValue] in sources" :key="title" :class="clsx('', !isValue && 'text-slate-400')">
            {{ title }} {{ isValue ? "✅" : "required" }}
          </li>
        </ul>

        <button
          :class="clsx('p-1.5 bg-slate-900 cursor-pointer disabled:text-slate-400 disabled:cursor-not-allowed')"
          :disabled="isPlayDisabled"
          @click="handlePlay"
        >
          ▶️ Play
        </button>

        <!-- 🎥 Recording controls -->
        <div class="flex items-center gap-2 text-xs">
          <button
            class="px-2 py-1 rounded bg-emerald-700 disabled:bg-emerald-900 disabled:text-slate-500"
            :disabled="isRecording"
            @click="startRecording"
          >
            ⬤ Record
          </button>
          <button
            class="px-2 py-1 rounded bg-rose-700 disabled:bg-rose-900 disabled:text-slate-500"
            :disabled="!isRecording"
            @click="stopRecording"
          >
            ■ Stop
          </button>
          <span v-if="isRecording" class="text-rose-400 ml-1"> Recording… </span>
        </div>

        <button
          :class="clsx('p-1.5 bg-slate-900 cursor-pointer disabled:text-slate-400 disabled:cursor-not-allowed')"
          @click="isCanvasShown = !isCanvasShown"
        >
          Show {{ isCanvasShown ? "DOM" : "Canvas" }}
        </button>
        <p>⎵ spacebar to start/stop.</p>
      </div>

      <!-- 🧠 Debug HUD: only core audio values (composables used in both modes) -->
      <div v-if="!isRecording" class="fixed bottom-4 left-4 text-xs bg-black/60 px-3 py-2 rounded z-20">
        <div>bass: {{ bassLevel.toFixed(2) }}</div>
        <div>mids: {{ midLevel.toFixed(2) }}</div>
        <div>beatBoost: {{ beatBoost.toFixed(2) }}</div>
        <div>isBeat: {{ isBeat ? "yes" : "no" }}</div>
      </div>

      <!-- 🎥 Canvas visualizer (no DOM composables) -->
      <VisualizerCanvas
        v-if="isCanvasShown"
        :on-canvas-ready="setRecordCanvas"
      />

      <!-- 🖼 DOM visualizer (DOM composables live here) -->
      <VisualizerDom
        v-else
        :background="background"
        :image-filter="imageFilter"
        :is-beat="isBeat"
        :bass-level="bassLevel"
        :mid-level="midLevel"
        :beat-boost="beatBoost"
      />

      <!-- 📁 Idle upload prompt -->
      <div
        class="fixed left-1/2 -translate-y-1/2 top-1/2 -translate-x-1/2 text-xl flex flex-col items-center gap-4 z-0"
      >
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
