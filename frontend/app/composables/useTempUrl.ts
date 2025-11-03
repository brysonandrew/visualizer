// composables/useTempUrl.ts
import { ref, onBeforeUnmount } from 'vue'

export function useTempUrl() {
  const url = ref<string | null>(null)

  function setFromFile(file: File) {
    clear()
    url.value = URL.createObjectURL(file)
  }

  function clear() {
    if (url.value) {
      URL.revokeObjectURL(url.value)
      url.value = null
    }
  }

  onBeforeUnmount(clear)

  return { url, setFromFile, clear }
}