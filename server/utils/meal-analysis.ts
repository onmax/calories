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
}).refine(
  analysis => analysis.totalCalories === analysis.items.reduce((total, item) => total + item.calories, 0),
  { message: "totalCalories must equal the sum of item calories", path: ["totalCalories"] },
)

export type MealAnalysis = z.infer<typeof mealAnalysisSchema>

export const mealAnalysisOutputSchema = z.union([
  mealAnalysisSchema,
  z.array(mealAnalysisSchema).min(1),
])

export type MealAnalysisOutput = z.infer<typeof mealAnalysisOutputSchema>
