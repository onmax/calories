import { createGateway } from "@ai-sdk/gateway"
import { createTelegramAdapter } from "@chat-adapter/telegram"
import { and, eq, gte, or } from "drizzle-orm"
import { useStorage } from "nitro/storage"
import { defineAgent, type ImagePart } from "vite-hub/agent"
import { telegram } from "vite-hub/agent/channels"
import { blob } from "vite-hub/blob"
import { renderMarkdownTemplate } from "vite-hub/markdown-template"
import { useServerEnv } from "#vitehub/env/server"
import database, * as schema from "../../databases/config"
import { getTelegramPhotoIdentity } from "../../utils/meal-deduplication"
import { mealAnalysisOutputSchema, type MealAnalysisOutput } from "../../utils/meal-analysis"
import { createJpegPerceptualHash } from "../../utils/photo-perceptual-hash"

const model = "zai/glm-5v-turbo"

async function createTelegramMealId(chatId: string, photoIdentity: string): Promise<string> {
  const input = new TextEncoder().encode(`${chatId}\0${photoIdentity}`)
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", input))
  const hex = Array.from(digest, byte => byte.toString(16).padStart(2, "0")).join("")
  return `telegram-${hex.slice(0, 32)}`
}

export default defineAgent({
  channels: {
    telegram: telegram({
      adapter: (() => {
        const { telegram } = useServerEnv()
        return createTelegramAdapter({
          allowedUserIds: [telegram.allowedUserId],
          botToken: telegram.botToken.unseal(),
          mode: "webhook",
          secretToken: telegram.webhookSecret?.unseal(),
          userName: "vitehub_calories_bot",
        })
      }),
      messages: {
        concurrency: "parallel",
        delivery: "manual",
        errorFallbackText: "I couldn’t analyze that photo. Please send it again.",
        fallbackStreamingPlaceholderText: "Analyzing photo…",
        filter: ({ message }) => message.parts.some(part => part.type === "image"),
        threadHistory: { maxMessages: 5 },
        timeout: 25_000,
      },
      webhooks: {
        id: "telegram",
        secretToken: () => useServerEnv().telegram.webhookSecret?.unseal() || false,
      },
    }),
  },
  driver: {
    model: () => createGateway({
      apiKey: useServerEnv().vercelAiGatewayToken.unseal(),
    })(model),
    output: { schema: mealAnalysisOutputSchema },
  },
  hooks: {
    async "agent:finish"(event) {
      if (event.error) return

      const result = event.result as MealAnalysisOutput
      const analyses = Array.isArray(result) ? result : [result]
      const messages = event.input.messages ?? []
      const run = event.invocation.run
      const currentMessage = messages.find(message => message.id === run?.messageId) ?? messages.at(-1)
      const images = currentMessage?.parts.filter((part): part is ImagePart => part.type === "image") ?? []
      if (!images.length) throw new Error("The Calories Agent requires at least one image.")
      if (analyses.length > 1 && analyses.length !== images.length) {
        throw new Error("The Calories Agent must return one analysis per image.")
      }

      const chatId = run?.threadId?.replace(/^telegram:/, "").split(":")[0]
      const messageId = Number(run?.messageId?.split(":").at(-1))
      if (!chatId || !Number.isSafeInteger(messageId)) throw new Error("Telegram channel metadata is incomplete.")

      const usage = event.invocation.usage
      const costUsd = usage?.cost?.currency === "USD" ? Number(usage.cost.amount) : 0
      const timestamp = new Date()
      const batches = analyses.length === 1
        ? [{ analysis: analyses[0]!, images }]
        : analyses.map((analysis, index) => ({ analysis, images: [images[index]!] }))
      const persisted = await Promise.all(batches.map(async ({ analysis, images: batchImages }) => {
        const telegramPhotoIdentity = getTelegramPhotoIdentity(batchImages)
        if (telegramPhotoIdentity) {
          const [existing] = await database.select()
            .from(schema.meals)
            .where(and(
              eq(schema.meals.telegramChatId, chatId),
              eq(schema.meals.telegramPhotoUniqueId, telegramPhotoIdentity),
            ))
            .limit(1)
          if (existing) return { duplicate: true, meal: existing }
        }

        const photos = await Promise.all(batchImages.map(async (image, index) => {
          const data = image.fetchData ? await image.fetchData() : image.data
          const bytes = data instanceof Uint8Array
            ? data
            : data instanceof ArrayBuffer
              ? new Uint8Array(data)
              : data instanceof Blob
                ? new Uint8Array(await data.arrayBuffer())
                : undefined
          if (!bytes) throw new Error("Telegram did not provide binary image data.")

          const contentType = image.mediaType.startsWith("image/") ? image.mediaType : "image/jpeg"
          const perceptualHash = contentType === "image/jpeg"
            ? createJpegPerceptualHash(bytes)
            : undefined
          return { bytes, contentType, image, index, perceptualHash }
        }))
        const [photo] = photos
        if (!photo) throw new Error("The Calories Agent requires at least one photo.")

        const photoPerceptualHash = photos.every(photo => photo.perceptualHash)
          ? photos.map(photo => photo.perceptualHash).join(":")
          : undefined
        if (photoPerceptualHash) {
          const [existing] = await database.select()
            .from(schema.meals)
            .where(and(
              eq(schema.meals.telegramChatId, chatId),
              eq(schema.meals.photoPerceptualHash, photoPerceptualHash),
            ))
            .limit(1)
          if (existing) return { duplicate: true, meal: existing }
        }

        const identity = photoPerceptualHash ?? telegramPhotoIdentity
        const id = identity
          ? await createTelegramMealId(chatId, identity)
          : crypto.randomUUID()
        const storedPhotos = await Promise.all(photos.map(async (photo) => {
          const photoPath = photo.index === 0 ? `meals/${id}/original` : `meals/${id}/photos/${photo.index}`
          const [storageError] = await blob.put(photoPath, photo.bytes, {
            access: "private",
            contentType: photo.contentType,
            customMetadata: { mealId: id, source: "telegram" },
          })
          if (storageError) throw storageError
          return { ...photo, photoPath }
        }))
        const [storedPhoto] = storedPhotos
        if (!storedPhoto) throw new Error("The Calories Agent requires at least one stored photo.")

        const meal = {
          analyzedAt: timestamp,
          assumptions: analysis.assumptions,
          confidence: analysis.confidence,
          costUsd: Number.isFinite(costUsd) ? costUsd / batches.length : 0,
          id,
          items: analysis.items,
          model,
          photoBytes: storedPhoto.bytes.byteLength,
          photoContentType: storedPhoto.contentType,
          photoPath: storedPhoto.photoPath,
          photoPerceptualHash,
          rawOutput: {
            ...analysis,
            photos: storedPhotos.map(({ bytes, contentType, photoPath }) => ({
              bytes: bytes.byteLength,
              contentType,
              path: photoPath,
            })),
          },
          status: "ready" as const,
          telegramChatId: chatId,
          telegramMessageId: messageId,
          telegramPhotoFileId: storedPhoto.image.fetchMetadata?.fileId,
          telegramPhotoUniqueId: telegramPhotoIdentity,
          totalCalories: analysis.totalCalories,
          updatedAt: timestamp,
        }
        if (!identity) {
          await database.insert(schema.meals).values(meal)
          return { duplicate: false, meal }
        }

        await database.insert(schema.meals).values(meal).onConflictDoNothing()
        const [stored] = await database.select()
          .from(schema.meals)
          .where(and(
            eq(schema.meals.telegramChatId, chatId),
            or(
              photoPerceptualHash
                ? eq(schema.meals.photoPerceptualHash, photoPerceptualHash)
                : undefined,
              telegramPhotoIdentity
                ? eq(schema.meals.telegramPhotoUniqueId, telegramPhotoIdentity)
                : undefined,
            ),
          ))
          .limit(1)
        if (!stored) throw new Error("The Calories Agent could not resolve the stored photo.")
        return { duplicate: stored.id !== id, meal: stored }
      }))
      const rows = persisted.map(result => result.meal)

      const startOfTodayUtc = new Date(timestamp)
      startOfTodayUtc.setUTCHours(0, 0, 0, 0)
      const readyMeals = await database.select({
        totalCalories: schema.meals.totalCalories,
      })
        .from(schema.meals)
        .where(and(
          eq(schema.meals.status, "ready"),
          eq(schema.meals.telegramChatId, chatId),
          gte(schema.meals.createdAt, startOfTodayUtc),
        ))
      const todayCalories = readyMeals.reduce(
        (total, meal) => total + (meal.totalCalories ?? 0),
        0,
      )

      if (!event.runtime.request) throw new Error("The Telegram request URL is unavailable.")
      const url = new URL("/", event.runtime.request.url)
      url.searchParams.set("meal", rows[0]!.id)

      const reply = await useStorage<string>("assets/calories-agent").getItem("reply.md")
      if (!reply) throw new Error("The Calories Agent reply template is unavailable.")

      return event.reply(await renderMarkdownTemplate(reply, {
        data: {
          dashboardLink: `[Open dashboard](${url})`,
          duplicateNotice: persisted.some(result => result.duplicate)
            ? "Already logged — this photo was not counted again.\n\n"
            : "",
          items: rows
            .flatMap(meal => meal.items)
            .map(item => `- ${item.name}, ${item.portion}: ${item.calories.toLocaleString("en-US")} kcal`)
            .join("\n"),
          todayCalories: todayCalories.toLocaleString("en-US"),
          totalCalories: rows
            .reduce((total, meal) => total + (meal.totalCalories ?? 0), 0)
            .toLocaleString("en-US"),
        },
      }))
    },
  },
})
