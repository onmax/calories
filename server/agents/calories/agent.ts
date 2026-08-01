import { and, eq, or } from "drizzle-orm"
import { useStorage } from "nitro/storage"
import { createGateway, generateText, Output, type LanguageModelUsage } from "ai-v7"
import { defineAgent, gateway, type AgentUsage, type AgentUsageRecord, type ImagePart, type Message } from "vite-hub/agent"
import { db, usage, vercelAiGatewayPricing } from "vite-hub/agent/capabilities"
import { telegram } from "vite-hub/agent/channels"
import { blob } from "vite-hub/blob"
import { renderMarkdownTemplate } from "vite-hub/markdown-template"
import { useServerEnv } from "#vitehub/env/server"
import database, * as schema from "../../databases/config"
import { completeAlbumAnalyses, isolateFirstAlbumImage } from "../../utils/album-analysis"
import { getTelegramPhotoIdentity } from "../../utils/meal-deduplication"
import { caloriesAgentOutputSchema, mealAnalysisSchema, type CaloriesAgentOutput } from "../../utils/meal-analysis"
import { createJpegPerceptualHash } from "../../utils/photo-perceptual-hash"

const model = "zai/glm-5v-turbo"
const defaultTimeZone = "Asia/Bangkok"
const albumImages = new WeakMap<Message, ImagePart[]>()
const singlePhotoInstructions = `Analyze only the attached photo as one consumed portion.
Treat the user's caption, quantity, and time as ground truth. Focus on the centered, clear subject and exclude incidental background food. Use metric portions, account for plausible oil and sauces, and use low confidence when ingredients or depth are unclear. Clear unsweetened Japanese green tea is 0–5 kcal. Return only the single analysis object requested by the schema.`

function getUserTimeZone(): string {
  return useServerEnv().calories.timeZone ?? defaultTimeZone
}

function getLocalDateKey(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).format(date)
}

function currentTimeInstructions(): string {
  const timeZone = getUserTimeZone()
  const currentTime = new Intl.DateTimeFormat("en-US", {
    dateStyle: "full",
    timeStyle: "long",
    timeZone,
  }).format(new Date())
  return `The user's time zone is ${timeZone}. The current local date and time is ${currentTime}.`
}

function formatUsd(value: number): string {
  const fractionDigits = value > 0 && value < 0.01 ? 6 : 2
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
    style: "currency",
  }).format(value)
}

function formatUsageCost(usageRecord: AgentUsageRecord | undefined): { cost: string, costUsd?: number } {
  const usageCost = usageRecord?.cost
  const parsedCostUsd = usageCost?.currency === "USD" ? Number(usageCost.amount) : undefined
  const costUsd = parsedCostUsd !== undefined && Number.isFinite(parsedCostUsd) ? parsedCostUsd : undefined
  return {
    cost: costUsd === undefined
      ? "Cost unavailable"
      : `${usageCost?.estimated ? "~" : ""}${formatUsd(costUsd)}`,
    ...(costUsd === undefined ? {} : { costUsd }),
  }
}

async function resolveImageData(image: ImagePart): Promise<ArrayBuffer | string | Uint8Array | URL> {
  const data = image.fetchData ? await image.fetchData() : image.data
  if (data instanceof Blob) return await data.arrayBuffer()
  if (data !== undefined) return data
  if (image.url) return new URL(image.url)
  throw new Error("Telegram did not provide image data for analysis.")
}

function combineUsage(base: AgentUsage | undefined, additions: LanguageModelUsage[]): AgentUsage | undefined {
  if (!base && additions.length === 0) return
  const records = [base, ...additions].filter((value): value is AgentUsage | LanguageModelUsage => !!value)
  const sum = (key: "inputTokens" | "outputTokens" | "totalTokens") => {
    const values = records.map(record => record[key]).filter((value): value is number => typeof value === "number")
    return values.length ? values.reduce((total, value) => total + value, 0) : undefined
  }
  const inputTokens = sum("inputTokens")
  const outputTokens = sum("outputTokens")
  const totalTokens = sum("totalTokens")
  return {
    ...base,
    ...(inputTokens === undefined ? {} : { inputTokens }),
    ...(outputTokens === undefined ? {} : { outputTokens }),
    ...(totalTokens === undefined ? {} : { totalTokens }),
  }
}

async function createTelegramMealId(chatId: string, photoIdentity: string): Promise<string> {
  const input = new TextEncoder().encode(`${chatId}\0${photoIdentity}`)
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", input))
  const hex = Array.from(digest, byte => byte.toString(16).padStart(2, "0")).join("")
  return `telegram-${hex.slice(0, 32)}`
}

export default defineAgent({
  capabilities: [
    db({ mode: "write" }),
    usage(),
  ],
  channels: {
    telegram: telegram({
      allowedUserIds: () => [useServerEnv().telegram.allowedUserId],
      botToken: () => useServerEnv().telegram.botToken,
      messages: {
        concurrency: "queue",
        delivery: "manual",
        errorFallbackText: "I couldn’t handle that. Please try again.",
        fallbackStreamingPlaceholderText: "Thinking…",
        triggerHistory: { maxMessages: 8, source: "thread" },
        timeout: 50_000,
      },
      mode: "webhook",
      userName: "vitehub_calories_bot",
      webhookSecret: () => useServerEnv().telegram.webhookSecret ?? false,
    }),
  },
  driver: {
    instructions: currentTimeInstructions,
    model: gateway(model, () => ({
      apiKey: useServerEnv().vercelAiGatewayToken,
    })),
    output: { schema: caloriesAgentOutputSchema },
  },
  hooks: {
    "agent:input"(context) {
      const images = isolateFirstAlbumImage(context.input.messages ?? [], context.run?.messageId)
      const currentMessage = context.input.messages?.find(message => message.id === context.run?.messageId)
        ?? context.input.messages?.at(-1)
      if (images && currentMessage) albumImages.set(currentMessage, images)
    },
    async "agent:finish"(event) {
      if (event.error) return

      const result = event.result as CaloriesAgentOutput
      const usageRecord = event.extensions.get("usage")
      if (result.kind === "reply") {
        const { cost } = formatUsageCost(usageRecord)
        return event.reply(`${result.text}\n\n${cost}`)
      }

      let analyses = result.analyses
      const messages = event.input.messages ?? []
      const run = event.invocation.run
      const currentMessage = messages.find(message => message.id === run?.messageId) ?? messages.at(-1)
      const firstImage = currentMessage?.parts.filter((part): part is ImagePart => part.type === "image") ?? []
      const images = currentMessage ? albumImages.get(currentMessage) ?? firstImage : firstImage
      if (images.length > 1 && analyses.length !== images.length) {
        if (analyses.length !== 1) throw new Error("The Calories Agent must return one analysis for the first album image.")
        const gatewayModel = createGateway({ apiKey: useServerEnv().vercelAiGatewayToken.unseal() })(model)
        const additionalUsage: LanguageModelUsage[] = []
        analyses = await completeAlbumAnalyses(analyses[0]!, images, async (image) => {
          const generation = await generateText({
            abortSignal: event.input.abortSignal,
            messages: [{
              content: [
                {
                  text: currentMessage?.parts
                    .flatMap(part => part.type === "text" ? [part.text] : [])
                    .join("\n")
                    .trim() || "Analyze this consumed meal.",
                  type: "text",
                },
                { image: await resolveImageData(image), mediaType: image.mediaType, type: "image" },
              ],
              role: "user",
            }],
            model: gatewayModel,
            output: Output.object({ schema: mealAnalysisSchema }),
            system: `${singlePhotoInstructions}\n\n${currentTimeInstructions()}`,
          })
          additionalUsage.push(generation.usage)
          return generation.output
        })

        const totalUsage = combineUsage(usageRecord?.usage, additionalUsage)
        if (usageRecord && totalUsage) {
          usageRecord.usage = totalUsage
          usageRecord.cost = await vercelAiGatewayPricing()({
            model: usageRecord.model,
            response: usageRecord.response,
            run: usageRecord.run ?? run,
            usage: totalUsage,
          }) ?? usageRecord.cost
        }
      }
      if (images.length > 1 && analyses.length !== images.length) {
        throw new Error("The Calories Agent must return one analysis per image.")
      }
      const { cost, costUsd } = formatUsageCost(usageRecord)
      const caption = currentMessage?.parts
        .flatMap(part => part.type === "text" ? [part.text] : [])
        .join("\n")
        .trim() || undefined

      const chatId = run?.threadId?.replace(/^telegram:/, "").split(":")[0]
      const messageId = Number(run?.messageId?.split(":").at(-1))
      if (!chatId || !Number.isSafeInteger(messageId)) throw new Error("Telegram channel metadata is incomplete.")

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
        const photoPerceptualHash = photos.length > 0 && photos.every(photo => photo.perceptualHash)
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
        const createdAt = analysis.consumedAt ? new Date(analysis.consumedAt) : timestamp

        const meal = {
          analyzedAt: timestamp,
          assumptions: analysis.assumptions,
          caption,
          confidence: analysis.confidence,
          costUsd: costUsd === undefined ? 0 : costUsd / batches.length,
          id,
          items: analysis.items,
          model,
          photoBytes: storedPhoto?.bytes.byteLength,
          photoContentType: storedPhoto?.contentType,
          photoPath: storedPhoto?.photoPath,
          photoPerceptualHash,
          rawOutput: {
            ...analysis,
            photos: storedPhotos.map(({ bytes, contentType, photoPath }) => ({
              bytes: bytes.byteLength,
              contentType,
              path: photoPath,
            })),
            usage: usageRecord,
          },
          status: "ready" as const,
          telegramChatId: chatId,
          telegramMessageId: messageId,
          telegramPhotoFileId: storedPhoto?.image.fetchMetadata?.fileId,
          telegramPhotoUniqueId: telegramPhotoIdentity,
          totalCalories: analysis.totalCalories,
          createdAt,
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

      const timeZone = getUserTimeZone()
      const todayKey = getLocalDateKey(timestamp, timeZone)
      const readyMeals = await database.select({
        createdAt: schema.meals.createdAt,
        totalCalories: schema.meals.totalCalories,
      })
        .from(schema.meals)
        .where(and(
          eq(schema.meals.status, "ready"),
          eq(schema.meals.telegramChatId, chatId),
        ))
      const todayCalories = readyMeals.reduce(
        (total, meal) => getLocalDateKey(meal.createdAt, timeZone) === todayKey
          ? total + (meal.totalCalories ?? 0)
          : total,
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
          cost,
          todayCalories: todayCalories.toLocaleString("en-US"),
          totalCalories: rows
            .reduce((total, meal) => total + (meal.totalCalories ?? 0), 0)
            .toLocaleString("en-US"),
        },
      }))
    },
  },
})
