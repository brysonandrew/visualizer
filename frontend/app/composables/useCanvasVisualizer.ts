// composables/useCanvasVisualizer.ts
import { watch, onBeforeUnmount, type Ref } from "vue"

type UseCanvasVisualizerOptions = {
  noiseImageUrl?: string
}

export function useCanvasVisualizer(
  canvasRef: Ref<HTMLCanvasElement | null>,
  opts: UseCanvasVisualizerOptions,
  state: {
    backgroundUrl: Ref<string | null>
    bassLevel: Ref<number>
    midLevel: Ref<number>
    beatBoost: Ref<number>
    isBeat: Ref<boolean>
    grainOpacity: Ref<number>
  }
) {
  const { noiseImageUrl = DEFAULT_NOISE_PATH } = opts

  let rafId: number | null = null
  let bgImg: HTMLImageElement | null = null
  let noiseImg: HTMLImageElement | null = null

  const loadImage = (src: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = src
    })

  // load noise once
  loadImage(noiseImageUrl)
    .then((img) => {
      noiseImg = img
    })
    .catch(() => {
      noiseImg = null
    })

  const startLoop = () => {
    if (rafId !== null) return
    const loop = () => {
      drawFrame()
      rafId = requestAnimationFrame(loop)
    }
    rafId = requestAnimationFrame(loop)
  }

  const stopLoop = () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
  }

  const drawFrame = () => {
    const canvas = canvasRef.value
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const { width, height } = canvas

    ctx.clearRect(0, 0, width, height)

    // background
    if (bgImg) {
      ctx.save()

      // match your DOM transform logic
      const scaleBase = 1.0
      const scaleBeat = state.isBeat.value ? 1.03 : 1.0
      const scale = scaleBase * scaleBeat

      const angleDeg = state.isBeat.value ? state.midLevel.value * 2 : state.midLevel.value * 1.5
      const angle = (angleDeg * Math.PI) / 180

      // approximate brightness/contrast from your imageFilter
      // const brightness = 1 + state.bassLevel.value * 0.7 + state.beatBoost.value * 0.8
      // const contrast = 1 + state.midLevel.value * 0.4 + state.beatBoost.value * 0.4
      const brightness = 1 + state.bassLevel.value * 0.35 + state.beatBoost.value * 0.45
      const contrast = 1 + state.midLevel.value * 0.25 + state.beatBoost.value * 0.25

      ctx.filter = `brightness(${brightness}) contrast(${contrast})`

      ctx.translate(width / 2, height / 2)
      ctx.rotate(angle)
      ctx.scale(scale, scale)

      const imgRatio = bgImg.width / bgImg.height
      const canvasRatio = width / height
      let drawW: number, drawH: number

      if (imgRatio > canvasRatio) {
        drawH = height
        drawW = height * imgRatio
      } else {
        drawW = width
        drawH = width / imgRatio
      }

      ctx.drawImage(bgImg, -drawW / 2, -drawH / 2, drawW, drawH)
      ctx.restore()
    }

    // center glow
    if (bgImg) {
      ctx.save()
      ctx.globalCompositeOperation = "screen"

      const cx = width / 2
      const cy = height / 2
      const radius = Math.max(width, height) * 0.6
      const intensity = Math.min(
        1,
        state.midLevel.value * 0.9 + state.bassLevel.value * 0.15 + state.beatBoost.value * 0.7
      )

      if (intensity > 0) {
        // center glow
        const innerAlpha = 0.4 * intensity
        const midAlpha = 0.2 * intensity

        // const innerAlpha = 0.8 * intensity
        // const midAlpha = 0.4 * intensity

        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius)
        grad.addColorStop(0, `rgba(227,165,58,${innerAlpha})`)
        grad.addColorStop(0.6, `rgba(227,165,58,${midAlpha})`)
        grad.addColorStop(1, "transparent")

        ctx.fillStyle = grad
        ctx.fillRect(0, 0, width, height)
      }

      ctx.restore()
    }

    // edge glow
    if (bgImg) {
      ctx.save()
      ctx.globalCompositeOperation = "screen"

      const cx = width / 2
      const cy = height / 2
      const radius = Math.max(width, height)
      const edgeIntensity = Math.min(
        1,
        state.bassLevel.value * 0.6 + state.midLevel.value * 0.2 + state.beatBoost.value * 1.0
      )

      if (edgeIntensity > 0) {
        // const innerAlpha = 0.25 * edgeIntensity
        // const outerAlpha = 0.85 * edgeIntensity

        const innerAlpha = 0.12 * edgeIntensity
        const outerAlpha = 0.45 * edgeIntensity

        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius)
        grad.addColorStop(0, "transparent")
        grad.addColorStop(0.45, "transparent")
        grad.addColorStop(0.65, `rgba(227,165,58,${innerAlpha})`)
        grad.addColorStop(1, `rgba(227,165,58,${outerAlpha})`)

        ctx.fillStyle = grad
        ctx.fillRect(0, 0, width, height)
      }

      ctx.restore()
    }

    // grain
    if (bgImg && noiseImg && state.grainOpacity.value > 0.01) {
      ctx.save()
      ctx.globalCompositeOperation = "soft-light"
      ctx.globalAlpha = state.grainOpacity.value

      const pattern = ctx.createPattern(noiseImg, "repeat")
      if (pattern) {
        ctx.fillStyle = pattern
        ctx.fillRect(0, 0, width, height)
      }

      ctx.restore()
    }
  }

  // update background when URL changes
  watch(
    () => state.backgroundUrl.value,
    (src) => {
      if (!src) {
        bgImg = null
        return
      }
      loadImage(src)
        .then((img) => {
          bgImg = img
        })
        .catch(() => {
          bgImg = null
        })
    },
    { immediate: true }
  )

  // start loop when canvas exists
  watch(
    canvasRef,
    (c) => {
      if (c) startLoop()
      else stopLoop()
    },
    { immediate: true }
  )

  onBeforeUnmount(stopLoop)
}
