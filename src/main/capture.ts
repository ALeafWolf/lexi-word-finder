import { desktopCapturer, screen, nativeImage } from 'electron'

export interface BoundingBox {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Captures the primary display and crops it to the given bounding box.
 * Returns a PNG Buffer ready for OCR processing.
 *
 * Handles high-DPI displays by adjusting crop coordinates with the
 * device pixel ratio (scaleFactor) of the primary display.
 */
export async function captureRegion(region: BoundingBox): Promise<Buffer> {
  const primaryDisplay = screen.getPrimaryDisplay()
  const { scaleFactor } = primaryDisplay
  const { width: screenW, height: screenH } = primaryDisplay.size

  // desktopCapturer gives us an image at device pixels (scaled)
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: {
      width: Math.round(screenW * scaleFactor),
      height: Math.round(screenH * scaleFactor)
    }
  })

  const primarySource = sources[0]
  if (!primarySource) {
    throw new Error('No screen source found for capture')
  }

  const fullImage = primarySource.thumbnail

  // Crop to the selected region, scaling coordinates by device pixel ratio
  const cropRect = {
    x: Math.round(region.x * scaleFactor),
    y: Math.round(region.y * scaleFactor),
    width: Math.round(region.width * scaleFactor),
    height: Math.round(region.height * scaleFactor)
  }

  const cropped = fullImage.crop(cropRect)

  // Resize back to logical pixels so downstream processing is resolution-independent
  const logicalSize = { width: region.width, height: region.height }
  const resized = nativeImage.createFromBuffer(
    cropped.resize(logicalSize).toPNG()
  )

  const pngBuffer = resized.toPNG()
  console.log(`[capture] Captured ${region.width}x${region.height} region (${pngBuffer.length} bytes)`)

  return pngBuffer
}

/**
 * Save a PNG buffer to disk (for debugging/verification).
 */
export async function savePngToDisk(buffer: Buffer, filepath: string): Promise<void> {
  const { writeFile } = await import('fs/promises')
  await writeFile(filepath, buffer)
  console.log(`[capture] Saved PNG to ${filepath}`)
}
