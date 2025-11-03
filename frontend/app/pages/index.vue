<script setup lang="ts">
const notification = useNotification()
import clsx from "clsx"

// notification.success({ title: 'Success!', message: 'Your action was completed successfully.' })
// notification.info({ title: 'Info', message: 'Here is some information.' })
// notification.warning({ title: 'Warning!', message: 'Be careful with this action.' })
// notification.question({ title: 'Confirmation', message: 'Are you sure you want to continue with this action?' })
const { url: background, setFromFile: setBackground } = useTempUrl()
const { isPlaying, hasBuffer, loadFile, toggle: togglePlay, onFrame, analyser, freq } = useAudioVisualizer()

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

// Example: simple bass meter each frame (replace with your flash logic)
onMounted(() => {
  onFrame(() => {
    if (!freq.value) return
    let sum = 0
    const bins = Math.min(32, freq.value.length)
    for (let i = 0; i < bins; i++) {
      const next = freq.value[i]
      if (next) {
        sum += next
      }
    }
    const bass = sum / bins
    console.log("bass", bass) // drive your CSS/class here
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
    <div class="relative flex items-center justify-center w-screen h-screen text-white bg-black hover:bg-slate-950 select-none">
      <div v-if="!isPlaying" class="flex flex-col gap-4 absolute top-4 left-4 bg-slate-800 p-2 rounded-md z-10">
        <ul>
          <li v-for="[title, isValue] in sources" :class="clsx('', !isValue && 'text-slate-400')">
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
        <p>⎵ spacebar to start/stop.</p>
      </div>
      <img v-if="background" class="absolute inset-0 w-full h-full object-cover" :src="background" alt="background" />
      <div class="text-xl flex flex-col items-center gap-4">
        <div class="text-4xl">📁</div>
        <div><b>Choose</b> or <b>drag</b> 🎧 🎇 here.</div>
      </div>

      <input
        class="absolute inset-0 opacity-0 cursor-pointer"
        type="file"
        accept="image/*,audio/*"
        @change="handleInputChange"
      />
    </div>
  </ClientOnly>
</template>
