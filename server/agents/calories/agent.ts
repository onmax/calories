import { createGateway } from "@ai-sdk/gateway"
import { createTelegramAdapter } from "@chat-adapter/telegram"
import { and, eq, gte } from "drizzle-orm"
import { useStorage } from "nitro/storage"
import { defineAgent, type ImagePart } from "vite-hub/agent"
import { telegram } from "vite-hub/agent/channels"
import { blob } from "vite-hub/blob"
import { renderMarkdownTemplate } from "vite-hub/markdown-template"
import { useServerEnv } from "#vitehub/env/server"
import database, * as schema from "../../databases/config"
import { mealAnalysisOutputSchema, type MealAnalysisOutput } from "../../utils/meal-analysis"

const model = "zai/glm-5v-turbo"

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
        filter: async ({ message, thread }) => {
          const hasImage = message.parts.some(part => part.type === "image")
          if (hasImage) await thread.post("Analyzing photo…")
          return hasImage
        },
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
      const rows = await Promise.all(batches.map(async ({ analysis, images: batchImages }) => {
        const id = crypto.randomUUID()
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
          const photoPath = index === 0 ? `meals/${id}/original` : `meals/${id}/photos/${index}`
          const [storageError] = await blob.put(photoPath, bytes, {
            access: "private",
            contentType,
            customMetadata: { mealId: id, source: "telegram" },
          })
          if (storageError) throw storageError
          return { bytes, contentType, image, photoPath }
        }))
        const [photo] = photos
        if (!photo) throw new Error("The Calories Agent requires at least one stored photo.")

        return {
          analyzedAt: timestamp,
          assumptions: analysis.assumptions,
          confidence: analysis.confidence,
          costUsd: Number.isFinite(costUsd) ? costUsd / batches.length : 0,
          id,
          items: analysis.items,
          model,
          photoBytes: photo.bytes.byteLength,
          photoContentType: photo.contentType,
          photoPath: photo.photoPath,
          rawOutput: {
            ...analysis,
            photos: photos.map(({ bytes, contentType, photoPath }) => ({
              bytes: bytes.byteLength,
              contentType,
              path: photoPath,
            })),
          },
          status: "ready" as const,
          telegramChatId: chatId,
          telegramMessageId: messageId,
          telegramPhotoFileId: photo.image.fetchMetadata?.fileId,
          totalCalories: analysis.totalCalories,
          updatedAt: timestamp,
        }
      }))
      await database.insert(schema.meals).values(rows)

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
          items: analyses
            .flatMap(analysis => analysis.items)
            .map(item => `• ${item.name}, ${item.portion}: ${item.calories.toLocaleString("en-US")} kcal`)
            .join("\n"),
          todayCalories: todayCalories.toLocaleString("en-US"),
          totalCalories: analyses
            .reduce((total, analysis) => total + analysis.totalCalories, 0)
            .toLocaleString("en-US"),
        },
      }))
    },
  },
})
