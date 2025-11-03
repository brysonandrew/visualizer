// composables/useCanvasRecorder.ts
import { ref, onBeforeUnmount, type Ref } from "vue"

type CanvasRecorderOptions = {
  fps?: number
  mimeType?: string
  autoDownload?: boolean
}

export function useCanvasRecorder(
  canvasRef: Ref<HTMLCanvasElement | null>,
  audioCtx: Ref<AudioContext | null>,
  outputNode: Ref<AudioNode | null>,
  options: CanvasRecorderOptions = {}
) {
  const {
    fps = 60,
    mimeType = "video/webm;codecs=vp9,opus",
    autoDownload = true
  } = options

  const isRecording = ref(false)
  const downloadUrl = ref<string | null>(null)
  const error = ref<string | null>(null)

  let recorder: MediaRecorder | null = null
  let chunks: BlobPart[] = []
  let destNode: MediaStreamAudioDestinationNode | null = null

  const startRecording = () => {
    error.value = null

    const canvas = canvasRef.value
    const ctx = audioCtx.value
    const out = outputNode.value

    if (!canvas || !ctx || !out) {
      error.value = "Missing canvas or audio context/output node."
      return
    }

    try {
      const videoStream = canvas.captureStream(fps)

      // tap the audio graph into a MediaStream
      destNode = ctx.createMediaStreamDestination()
      out.connect(destNode)

      const stream = new MediaStream([
        ...videoStream.getVideoTracks(),
        ...destNode.stream.getAudioTracks()
      ])

      recorder = new MediaRecorder(stream, { mimeType })
      chunks = []

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data)
      }

      recorder.onstop = () => {
        // clean up connection
        if (destNode) {
          try {
            out.disconnect(destNode)
          } catch {}
          destNode = null
        }

        const blob = new Blob(chunks, { type: mimeType })
        const url = URL.createObjectURL(blob)
        downloadUrl.value = url

        if (autoDownload) {
          const a = document.createElement("a")
          a.href = url
          a.download = "auroscuro-visualizer.webm"
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
        }
      }

      recorder.start()
      isRecording.value = true
    } catch (e: any) {
      console.error(e)
      error.value = e?.message ?? "Failed to start recording."
      recorder = null
      if (destNode && out) {
        try {
          out.disconnect(destNode)
        } catch {}
        destNode = null
      }
    }
  }

  const stopRecording = () => {
    if (recorder && recorder.state !== "inactive") {
      recorder.stop()
      recorder.stream.getTracks().forEach((t) => t.stop())
    }
    isRecording.value = false
  }

  onBeforeUnmount(() => {
    if (recorder && recorder.state !== "inactive") {
      recorder.stop()
      recorder.stream.getTracks().forEach((t) => t.stop())
    }
    if (downloadUrl.value) {
      URL.revokeObjectURL(downloadUrl.value)
      downloadUrl.value = null
    }
    if (destNode && outputNode.value) {
      try {
        outputNode.value.disconnect(destNode)
      } catch {}
      destNode = null
    }
  })

  return {
    isRecording,
    startRecording,
    stopRecording,
    downloadUrl,
    error
  }
}