<script setup lang="ts">
const background = ref<null | string>(null)
const audio = ref<null | File>(null)
const isPlaying = ref(false)
const audioContext = new AudioContext()
const audioSource = audioContext.createBufferSource()
const analyser = audioContext.createAnalyser()

const handlePlay = () => {
  // start playback
  audioSource.start()

  // optional: animation loop for visual data
  const dataArray = new Uint8Array(analyser.frequencyBinCount)
  function tick() {
    analyser.getByteFrequencyData(dataArray)
    // visualize here
    requestAnimationFrame(tick)
  }
  tick()
}

const loadAudioFile = async (file: File) => {
  const arrayBuf = await file.arrayBuffer()

  const audioBuffer = await audioContext.decodeAudioData(arrayBuf)

  audioSource.buffer = audioBuffer

  analyser.fftSize = 2048

  audioSource.connect(analyser)
  analyser.connect(audioContext.destination)
}

const handleClick = async () => {
  if (isPlaying.value) {
    await audioContext.suspend()
  } else {
    if (audio) {
      handlePlay()
    }
  }

  isPlaying.value = !isPlaying.value
}

const handleInputChange = (event: Event) => {
  const target = event.currentTarget as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  // Check MIME type
  if (file.type.startsWith("audio/")) {
    console.log(`🎵 Audio file selected: ${file.name}`)
    audio.value = file
    loadAudioFile(file)
    // Do something with the audio file here
  } else if (file.type.startsWith("image/")) {
    console.log(`🖼️ Image file selected: ${file.name}`)
    const src = URL.createObjectURL(file)
    // Do something with the image file here
    background.value = src
  } else {
    console.log(`⚠️ Unsupported file type: ${file.type}`)
  }
}
</script>

<template>
  <div class="bg-red-500 w-screen h-screen text-white" @click="handleClick">
    <p>Hello world</p>
    <img v-if="background" class="absolute inset-0 object-cover w-full h-full" :src="background" />
    <input class="absolute inset-0" type="file" accept="image/*,audio/*" @change="handleInputChange" />
  </div>
</template>
