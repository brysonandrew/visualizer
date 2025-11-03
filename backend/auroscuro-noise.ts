// generate-auroscuro-noise.js
import { createCanvas } from "canvas"
import { writeFileSync } from "fs"

const size = 512
const canvas = createCanvas(size, size)
const ctx = canvas.getContext("2d")

const imageData = ctx.createImageData(size, size)
for (let i = 0; i < imageData.data.length; i += 4) {
  const base = Math.random() * 200
  const tint = 0.2 + Math.random() * 0.8
  imageData.data[i] = base * 1.0 // R
  imageData.data[i + 1] = base * 0.8 // G
  imageData.data[i + 2] = base * 0.4 // B (warmer)
  imageData.data[i + 3] = 255 // opaque
}
ctx.putImageData(imageData, 0, 0)
writeFileSync("auroscuro-noise.png", canvas.toBuffer("image/png"))
