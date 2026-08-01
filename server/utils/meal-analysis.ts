import { z } from "zod"

export const mealAnalysisSchema = z.object({
  items: z.array(z.object({
    calories: z.number().int().nonnegative(),
    name: z.string().min(1),
    portion: z.string().min(1),
  })).min(1),
  totalCalories: z.number().int().nonnegative(),
  assumptions: z.array(z.string().min(1)),
  confidence: z.enum(["low", "medium", "high"]),
  consumedAt: z.string().datetime({ offset: true }).optional(),
}).refine(
  analysis => analysis.totalCalories === analysis.items.reduce((total, item) => total + item.calories, 0),
  { message: "totalCalories must equal the sum of item calories", path: ["totalCalories"] },
)

export type MealAnalysis = z.infer<typeof mealAnalysisSchema>

export const mealAnalysisOutputInstructions = [
  "Return only one valid JSON value for the meal analysis. Do not wrap it in Markdown or add commentary.",
  "The JSON value must match this schema:",
  "```json",
  JSON.stringify(z.toJSONSchema(mealAnalysisSchema, { target: "draft-7" }), null, 2),
  "```",
].join("\n")

export function parseMealAnalysisOutput(text: string): MealAnalysis {
  const value = text.trim().match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i)?.[1]?.trim() ?? text.trim()
  return mealAnalysisSchema.parse(JSON.parse(value))
}

export const mealAnalysisOutputSchema = z.array(mealAnalysisSchema).min(1)

export type MealAnalysisOutput = z.infer<typeof mealAnalysisOutputSchema>

export const caloriesAgentOutputSchema = z.discriminatedUnion("kind", [
  z.object({
    analyses: mealAnalysisOutputSchema,
    kind: z.literal("meal"),
  }),
  z.object({
    kind: z.literal("reply"),
    text: z.string().min(1),
  }),
])

export type CaloriesAgentOutput = z.infer<typeof caloriesAgentOutputSchema>
