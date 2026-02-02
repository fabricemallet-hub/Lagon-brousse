import { z } from 'zod';

// Schemas for find-best-fishing-day flow
const FishingSpotContextSchema = z.object({
  timestamp: z.string(),
  moonPhase: z.string(),
  tideHeight: z.number(),
  tideMovement: z.string(),
  tideCurrent: z.string(),
  weatherCondition: z.string(),
  windSpeed: z.number(),
  windDirection: z.string(),
  airTemperature: z.number(),
  waterTemperature: z.number(),
  swellInside: z.string().optional(),
  swellOutside: z.string().optional(),
});

export const FindSimilarDayInputSchema = z.object({
  spotContext: FishingSpotContextSchema,
  location: z.string(),
  searchRangeDays: z.number().default(30),
});
export type FindSimilarDayInput = z.infer<typeof FindSimilarDayInputSchema>;

export const AnalyzeBestDayInputSchema = z.object({
  spotContexts: z.array(FishingSpotContextSchema),
  location: z.string(),
  searchRangeDays: z.number().default(7),
});
export type AnalyzeBestDayInput = z.infer<typeof AnalyzeBestDayInputSchema>;

export const FishingAnalysisOutputSchema = z.object({
  bestDate: z.string().describe('The best date found in YYYY-MM-DD format.'),
  explanation: z.string().describe("A detailed explanation of why this date was chosen, comparing the key factors."),
  score: z.number().describe("A confidence score from 0 to 100 on how good the match is."),
});
export type FishingAnalysisOutput = z.infer<typeof FishingAnalysisOutputSchema>;
