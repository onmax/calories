import { createGateway } from "@ai-sdk/gateway"
import { createTelegramAdapter } from "@chat-adapter/telegram"
import { useStorage } from "nitro/storage"
import { defineAgent } from "vite-hub/agent"
import { telegram } from "vite-hub/agent/channels"
import { blob } from "vite-hub/blob"
import { renderMarkdownTemplate } from "vite-hub/markdown-template"
import { useServerEnv } from "#vitehub/env/server"
import database, * as schema from "../../databases/config"
import { mealAnalysisSchema, type MealAnalysis } from "../../utils/meal-analysis"

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
        errorFallbackText: "I couldn’t analyze that photo. Please send it again.",
        fallbackStreamingPlaceholderText: "Photo saved. Analyzing…",
        final: "hidden",
        filter: ({ message }) => message.parts.length === 1 && message.parts[0]?.type === "image",
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
    output: { schema: mealAnalysisSchema },
  },
  hooks: {
    async "agent:finish"(event) {
      if (event.error) return

      const analysis = event.result as MealAnalysis
      const messages = event.input.messages ?? []
      const image = messages.at(-1)?.parts[0]
      if (image?.type !== "image") throw new Error("The Calories Agent requires one image.")

      const run = event.invocation.run
      const chatId = run?.threadId?.replace(/^telegram:/, "").split(":")[0]
      const messageId = Number(run?.messageId?.split(":").at(-1))
      if (!chatId || !Number.isSafeInteger(messageId)) throw new Error("Telegram channel metadata is incomplete.")

      const data = image.fetchData ? await image.fetchData() : image.data
      const bytes = data instanceof Uint8Array
        ? data
        : data instanceof ArrayBuffer
          ? new Uint8Array(data)
          : data instanceof Blob
            ? new Uint8Array(await data.arrayBuffer())
            : undefined
      if (!bytes) throw new Error("Telegram did not provide binary image data.")

      const id = crypto.randomUUID()
      const contentType = image.mediaType.startsWith("image/") ? image.mediaType : "image/jpeg"
      const photoPath = `meals/${id}/original`
      const [storageError] = await blob.put(photoPath, bytes, {
        access: "private",
        contentType,
        customMetadata: { mealId: id, source: "telegram" },
      })
      if (storageError) throw storageError

      const usage = event.invocation.usage
      const costUsd = usage?.cost?.currency === "USD" ? Number(usage.cost.amount) : 0
      const timestamp = new Date()
      await database.insert(schema.meals).values({
        analyzedAt: timestamp,
        assumptions: analysis.assumptions,
        confidence: analysis.confidence,
        costUsd: Number.isFinite(costUsd) ? costUsd : 0,
        id,
        items: analysis.items,
        model,
        photoBytes: bytes.byteLength,
        photoContentType: contentType,
        photoPath,
        rawOutput: { ...analysis },
        status: "ready",
        telegramChatId: chatId,
        telegramMessageId: messageId,
        telegramPhotoFileId: image.fetchMetadata?.fileId,
        totalCalories: analysis.totalCalories,
        updatedAt: timestamp,
      })

      if (!event.runtime.request) throw new Error("The Telegram request URL is unavailable.")
      const url = new URL("/", event.runtime.request.url)
      url.searchParams.set("meal", id)

      const reply = await useStorage<string>("assets/calories-agent").getItem("reply.md")
      if (!reply) throw new Error("The Calories Agent reply template is unavailable.")

      return event.reply(await renderMarkdownTemplate(reply, {
        data: {
          dashboardLink: `[Open dashboard](${url})`,
          items: analysis.items
            .map(item => `• ${item.name}, ${item.portion}: ${item.calories.toLocaleString("en-US")} kcal`)
            .join("\n"),
          totalCalories: analysis.totalCalories.toLocaleString("en-US"),
        },
      }))
    },
  },
})
