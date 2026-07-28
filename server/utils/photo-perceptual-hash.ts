import { decode } from "jpeg-js"

interface RgbaImage {
  data: Uint8Array
  height: number
  width: number
}

function luminance(image: RgbaImage, x: number, y: number): number {
  const index = (y * image.width + x) * 4
  return (
    image.data[index]! * 299
    + image.data[index + 1]! * 587
    + image.data[index + 2]! * 114
  ) / 1000
}

function sampledLuminance(image: RgbaImage, x: number, y: number, columns: number, rows: number): number {
  const sourceX = Math.round((x + 0.5) * (image.width - 1) / columns)
  const sourceY = Math.round((y + 0.5) * (image.height - 1) / rows)
  return luminance(image, sourceX, sourceY)
}

function bitsToHex(bits: boolean[]): string {
  let value = 0n
  for (const bit of bits) value = (value << 1n) | (bit ? 1n : 0n)
  return value.toString(16).padStart(Math.ceil(bits.length / 4), "0")
}

export function createPerceptualHash(image: RgbaImage): string {
  const averageSamples = Array.from({ length: 64 }, (_, index) => {
    const x = index % 8
    const y = Math.floor(index / 8)
    return sampledLuminance(image, x, y, 8, 8)
  })
  const average = averageSamples.reduce((sum, value) => sum + value, 0) / averageSamples.length
  const averageHash = bitsToHex(averageSamples.map(value => value >= average))

  const differenceBits: boolean[] = []
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      differenceBits.push(
        sampledLuminance(image, x, y, 9, 8)
        > sampledLuminance(image, x + 1, y, 9, 8),
      )
    }
  }

  return `${bitsToHex(differenceBits)}:${averageHash}`
}

export function createJpegPerceptualHash(bytes: Uint8Array): string {
  const image = decode(bytes, {
    formatAsRGBA: true,
    maxMemoryUsageInMB: 128,
    maxResolutionInMP: 40,
    tolerantDecoding: true,
    useTArray: true,
  })
  return createPerceptualHash(image)
}
