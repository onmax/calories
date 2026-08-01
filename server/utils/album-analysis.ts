import type { ImagePart, Message } from "vite-hub/agent"
import type { MealAnalysis } from "./meal-analysis"

export function isolateFirstAlbumImage(messages: Message[], currentMessageId?: string): ImagePart[] | undefined {
  const message = messages.find(message => message.id === currentMessageId) ?? messages.at(-1)
  if (!message) return

  const images = message.parts.filter((part): part is ImagePart => part.type === "image")
  if (images.length < 2) return

  let keptImage = false
  message.parts = message.parts.filter((part) => {
    if (part.type !== "image") return true
    if (keptImage) return false
    keptImage = true
    return true
  })
  return images
}

export async function completeAlbumAnalyses(
  firstAnalysis: MealAnalysis,
  images: ImagePart[],
  analyzeImage: (image: ImagePart) => Promise<MealAnalysis>,
): Promise<MealAnalysis[]> {
  return [firstAnalysis, ...await Promise.all(images.slice(1).map(analyzeImage))]
}
