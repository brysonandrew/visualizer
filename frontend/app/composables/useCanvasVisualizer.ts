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

  // cached drawing state
  let lastDpr = 0
  let lastCanvasW = 0
  let lastCanvasH = 0
  let ctx: CanvasRenderingContext2D | null = null
  let centerGrad: CanvasGradient | null = null
  let edgeGrad: CanvasGradient | null = null
  let grainPattern: CanvasPattern | null = null

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

  const setupCanvasIfNeeded = (canvas: HTMLCanvasElement) => {
    const dpr = window.devicePixelRatio || 1
    const targetW = canvasWidth
    const targetH = canvasHeight

    const needResize = canvas.width !== targetW * dpr || canvas.height !== targetH * dpr || dpr !== lastDpr

    if (!needResize && ctx) return

    canvas.width = targetW * dpr
    canvas.height = targetH * dpr
    lastDpr = dpr
    lastCanvasW = targetW
    lastCanvasH = targetH

    ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.imageSmoothingEnabled = true
    // @ts-ignore
    ctx.imageSmoothingQuality = "high"

    // (re)build gradients for this size
    const width = targetW
    const height = targetH
    const cx = width / 2
    const cy = height / 2

    // center glow shape
    const centerRadius = Math.max(width, height) * 0.6
    const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, centerRadius)
    cg.addColorStop(0, "rgba(227,165,58,1)")
    cg.addColorStop(0.6, "rgba(227,165,58,0.5)")
    cg.addColorStop(1, "transparent")
    centerGrad = cg

    // edge glow shape
    const edgeRadius = Math.max(width, height)
    const eg = ctx.createRadialGradient(cx, cy, 0, cx, cy, edgeRadius)
    eg.addColorStop(0, "transparent")
    eg.addColorStop(0.45, "transparent")
    eg.addColorStop(0.65, "rgba(227,165,58,0.5)")
    eg.addColorStop(1, "rgba(227,165,58,1)")
    edgeGrad = eg

    // reset grainPattern so it can be recreated with this context
    grainPattern = null
  }

  const drawFrame = () => {
    const canvas = canvasRef.value
    if (!canvas) return

    setupCanvasIfNeeded(canvas)
    if (!ctx) return

    const width = lastCanvasW
    const height = lastCanvasH

    ctx.clearRect(0, 0, width, height)

    // 🖼 background image
    if (bgImg) {
      ctx.save()

      const overscan = 1.1 // 👈 10% bigger to hide rotation edges

      const scaleBase = 1.0
      const scaleBeat = state.isBeat.value ? 1.03 : 1.0
      const scale = scaleBase * scaleBeat

      const angleDeg = state.isBeat.value ? state.midLevel.value * 2 : state.midLevel.value * 1.5
      const angle = (angleDeg * Math.PI) / 180

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

      // 🔍 overscan so rotation never reveals background
      drawW *= overscan
      drawH *= overscan

      ctx.drawImage(bgImg, -drawW / 2, -drawH / 2, drawW, drawH)
      ctx.restore()
    }

    if (bgImg) {
      const cx = width / 2
      const cy = height / 2

      // one screen composite block for both glows
      ctx.save()
      ctx.globalCompositeOperation = "screen"

      // ✨ center glow
      const centerIntensity = Math.min(
        1,
        state.midLevel.value * 0.9 + state.bassLevel.value * 0.15 + state.beatBoost.value * 0.7
      )
      if (centerIntensity > 0 && centerGrad) {
        ctx.globalAlpha = centerIntensity * 0.6 // scale strength
        ctx.fillStyle = centerGrad
        ctx.fillRect(0, 0, width, height)
      }

      // 🌌 edge glow
      const edgeIntensity = Math.min(
        1,
        state.bassLevel.value * 0.6 + state.midLevel.value * 0.2 + state.beatBoost.value * 1.0
      )
      if (edgeIntensity > 0 && edgeGrad) {
        ctx.globalAlpha = edgeIntensity * 0.5
        ctx.fillStyle = edgeGrad
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

      const tonal = state.midLevel.value * midWeight + state.bassLevel.value * bassWeight
      const punch = state.beatBoost.value * beatWeight
      const raw = baseOpacity + tonal + punch
      const grainOpacity = Math.min(maxOpacity, Math.max(0, raw))

      if (grainOpacity > 0.01) {
        ctx.save()
        ctx.globalCompositeOperation = "soft-light"
        ctx.globalAlpha = grainOpacity

        if (!grainPattern) {
          grainPattern = ctx.createPattern(noiseImg, "repeat")
        }

        if (grainPattern) {
          ctx.fillStyle = grainPattern
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
