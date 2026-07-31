interface TelegramImage {
  fetchMetadata?: Record<string, string>
}

export function getTelegramPhotoIdentity(images: TelegramImage[]): string | undefined {
  const uniqueIds = images.map(image => image.fetchMetadata?.fileUniqueId)
  if (uniqueIds.length === 0 || uniqueIds.some(uniqueId => !uniqueId)) return
  return uniqueIds.join(":")
}
