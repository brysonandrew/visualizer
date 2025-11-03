<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from "vue"

const props = defineProps<{
  onCanvasReady?: (el: HTMLCanvasElement | null) => void
}>()

const canvasEl = ref<HTMLCanvasElement | null>(null)

onMounted(() => {
  if (props.onCanvasReady) {
    props.onCanvasReady(canvasEl.value)
  }
})

onBeforeUnmount(() => {
  if (props.onCanvasReady) {
    props.onCanvasReady(null)
  }
})
</script>

<template>
  <canvas
    ref="canvasEl"
    class="absolute inset-0"
  ></canvas>
</template>