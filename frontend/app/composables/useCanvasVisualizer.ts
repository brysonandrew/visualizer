// composables/useCanvasVisualizer.ts
import { watch, onBeforeUnmount, type Ref } from "vue"

// aspect ratio / dimensions for canvas-space in CSS pixels
const aspectKey = "16:9" as const
const canvasWidth = DIMENSIONS_FROM_ASPECT_RATIO_LOOKUP[aspectKey].width
const canvasHeight = DIMENSIONS_FROM_ASPECT_RATIO_LOOKUP[aspectKey].height

type UseCanvasVisualizerOptions = {
  noiseImageUrl: string | null
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
  }
) {
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

  // load noise once (optional)
  if (opts.noiseImageUrl) {
    loadImage(opts.noiseImageUrl)
      .then((img) => {
        noiseImg = img
      })
      .catch(() => {
        noiseImg = null
      })
  }

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

    const dpr = window.devicePixelRatio || 1
    const targetW = canvasWidth
    const targetH = canvasHeight

    // only reset size when needed (avoids clearing state every frame)
    if (canvas.width !== targetW * dpr || canvas.height !== targetH * dpr) {
      canvas.width = targetW * dpr
      canvas.height = targetH * dpr
    }

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // HiDPI transform: our drawing coords are now CSS pixels
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    // nicer scaling
    ctx.imageSmoothingEnabled = true
    // @ts-ignore
    ctx.imageSmoothingQuality = "high"

    const width = targetW
    const height = targetH

    ctx.clearRect(0, 0, width, height)

    // 🖼 background image
    if (bgImg) {
      ctx.save()

      const scaleBase = 1.0
      const scaleBeat = state.isBeat.value ? 1.03 : 1.0
      const scale = scaleBase * scaleBeat

      const angleDeg = state.isBeat.value
        ? state.midLevel.value * 2
        : state.midLevel.value * 1.5
      const angle = (angleDeg * Math.PI) / 180

      // gentler brightness/contrast
      const brightness =
        1 + state.bassLevel.value * 0.35 + state.beatBoost.value * 0.45
      const contrast =
        1 + state.midLevel.value * 0.25 + state.beatBoost.value * 0.25

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

    // ✨ center glow
    if (bgImg) {
      ctx.save()
      ctx.globalCompositeOperation = "screen"

      const cx = width / 2
      const cy = height / 2
      const radius = Math.max(width, height) * 0.6

      const centerIntensity = Math.min(
        1,
        state.midLevel.value * 0.9 +
          state.bassLevel.value * 0.15 +
          state.beatBoost.value * 0.7
      )

      if (centerIntensity > 0) {
        const innerAlpha = 0.4 * centerIntensity
        const midAlpha = 0.2 * centerIntensity

        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius)
        grad.addColorStop(0, `rgba(227,165,58,${innerAlpha})`)
        grad.addColorStop(0.6, `rgba(227,165,58,${midAlpha})`)
        grad.addColorStop(1, "transparent")

        ctx.fillStyle = grad
        ctx.fillRect(0, 0, width, height)
      }

      ctx.restore()
    }

    // 🌌 edge glow
    if (bgImg) {
      ctx.save()
      ctx.globalCompositeOperation = "screen"

      const cx = width / 2
      const cy = height / 2
      const radius = Math.max(width, height)

      const edgeIntensity = Math.min(
        1,
        state.bassLevel.value * 0.6 +
          state.midLevel.value * 0.2 +
          state.beatBoost.value * 1.0
      )

      if (edgeIntensity > 0) {
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

    // 🧱 grain (optional)
    if (bgImg && noiseImg) {
      const baseOpacity = 0.05
      const maxOpacity = 0.4
      const midWeight = 0.8
      const bassWeight = 0.2
      const beatWeight = 0.7

      const tonal =
        state.midLevel.value * midWeight +
        state.bassLevel.value * bassWeight
      const punch = state.beatBoost.value * beatWeight
      const raw = baseOpacity + tonal + punch
      const grainOpacity = Math.min(maxOpacity, Math.max(0, raw))

      if (grainOpacity > 0.01) {
        ctx.save()
        ctx.globalCompositeOperation = "soft-light"
        ctx.globalAlpha = grainOpacity

        const pattern = ctx.createPattern(noiseImg, "repeat")
        if (pattern) {
          ctx.fillStyle = pattern
          ctx.fillRect(0, 0, width, height)
        }

        ctx.restore()
      }
    }

    // 🎛 optional mild global desaturation
    if (bgImg) {
      ctx.save()
      ctx.globalCompositeOperation = "saturation"
      ctx.globalAlpha = 0.2
      ctx.fillStyle = "gray"
      ctx.fillRect(0, 0, width, height)
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