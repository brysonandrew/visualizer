// generate-noise.js
import { createCanvas } from "canvas"
import { writeFileSync } from "fs"

const size = 512
const canvas = createCanvas(size, size)
const ctx = canvas.getContext("2d")

const imageData = ctx.createImageData(size, size)
for (let i = 0; i < imageData.data.length; i += 4) {
  const n = Math.random() * 255
  imageData.data[i] = n // R
  imageData.data[i + 1] = n // G
  imageData.data[i + 2] = n // B
  imageData.data[i + 3] = 255 // A
}
ctx.putImageData(imageData, 0, 0)
writeFileSync("white-noise.png", canvas.toBuffer("image/png"))
