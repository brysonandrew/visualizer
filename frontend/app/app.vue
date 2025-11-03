<script setup lang="ts">
const background = ref<null|string>(null)
const audio = ref<null|File>(null)

const handleInputChange = (event: Event) => {
  const target = event.currentTarget as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  // Check MIME type
  if (file.type.startsWith("audio/")) {
    console.log(`🎵 Audio file selected: ${file.name}`)
    audio.value = file
    // Do something with the audio file here
  } else if (file.type.startsWith("image/")) {
    console.log(`🖼️ Image file selected: ${file.name}`)
    // Do something with the image file here
    const src = URL.createObjectURL(file)
    background.value = src
  } else {
    console.log(`⚠️ Unsupported file type: ${file.type}`)
  }
}
</script>

<template>
  <div class="bg-red-500 w-full h-screen flex flex-col items-center justify-center text-white">
    <p>Hello world</p>
    <img v-if="background" class="absolute inset-0" :src="background" />
    <input class="absolute inset-0" type="file" accept="image/*,audio/*" @change="handleInputChange" />
  </div>
</template>
