
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

// Gardening Flow Schemas
export const GardeningAdviceInputSchema = z.object({
  seedName: z.string().describe("The name of the seed entered by the user."),
  sowingDate: z.string().describe("The intended sowing date (ISO string)."),
  lunarPhase: z.string().describe("Current lunar phase (e.g., 'Lune Montante')."),
  zodiacSign: z.string().describe("Current zodiac influence (e.g., 'Fruits', 'Feuilles')."),
  upcomingCalendar: z.string().describe("A summary of the upcoming 30 days of lunar phases and zodiac signs to find the next best date."),
});
export type GardeningAdviceInput = z.infer<typeof GardeningAdviceInputSchema>;

export const GardeningAdviceOutputSchema = z.object({
  plantType: z.string().describe("Confirmed category of the plant (e.g., Légume-feuille, Fruit, Racine)."),
  isValidForMoon: z.boolean().describe("Whether the sowing is well-timed with the current moon phase and zodiac."),
  moonWarning: z.string().describe("A short warning if the timing is bad, or a confirmation if it's good. If bad, MUST suggest the next best date for this type of plant from the provided calendar."),
  cultureAdvice: z.string().describe("Key steps for success (watering, exposure, temp)."),
  harvestDate: z.string().describe("Estimated harvest date string (e.g., 'Mi-Mai 2024')."),
  transplantingAdvice: z.string().describe("Suggestion for ideal period to transplant to the ground."),
});
export type GardeningAdviceOutput = z.infer<typeof GardeningAdviceOutputSchema>;
