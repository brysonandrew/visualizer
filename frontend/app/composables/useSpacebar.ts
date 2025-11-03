export const useSpacebar = (callback: () => void) => {
  const handle = (e: KeyboardEvent) => {
    if (e.code === "Space") {
      e.preventDefault()
      callback()
    }
  }

  onMounted(() => window.addEventListener("keydown", handle))
  onBeforeUnmount(() => window.removeEventListener("keydown", handle))
}
