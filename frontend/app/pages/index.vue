<script setup lang="ts">
import { onMounted } from "vue"

const { url: background, setFromFile: setBg } = useTempUrl()
const { isPlaying, hasBuffer, loadFile, toggle, onFrame, analyser, freq } = useAudioVisualizer()

const handleInputChange = (event: Event) => {
  const input = event.currentTarget as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  if (file.type.startsWith("audio/")) {
    loadFile(file)
  } else if (file.type.startsWith("image/")) {
    setBg(file)
  } else {
    console.warn("Unsupported file type:", file.type)
  }
}

const handleClick = async () => {
  if (!hasBuffer.value) return
  toggle()
}

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
    // console.log('bass', bass) // drive your CSS/class here
  })
})
</script>

<template>
  <div class="relative w-screen h-screen text-white select-none" @click="handleClick">
    <p class="absolute top-4 left-4 z-10">{{ isPlaying ? "Pause" : "Play" }} (click)</p>

    <img v-if="background" class="absolute inset-0 w-full h-full object-cover" :src="background" alt="background" />

    <input
      class="absolute inset-0 opacity-0 cursor-pointer"
      type="file"
      accept="image/*,audio/*"
      @change="handleInputChange"
    />
  </div>
</template>
