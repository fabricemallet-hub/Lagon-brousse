
import { z } from 'zod';

// Schemas for find-best-fishing-day flow
// Making fields optional/default to prevent crashes on old or incomplete data
export const FishingSpotContextSchema = z.object({
  timestamp: z.string().optional().default(() => new Date().toISOString()),
  moonPhase: z.string().optional().default('Inconnue'),
  tideHeight: z.number().optional().default(0.5),
  tideMovement: z.string().optional().default('étale'),
  tideCurrent: z.string().optional().default('Nul'),
  weatherCondition: z.string().optional().default('Clair'),
  windSpeed: z.number().optional().default(5),
  windDirection: z.string().optional().default('E'),
  airTemperature: z.number().optional().default(25),
  waterTemperature: z.number().optional().default(24),
  swellInside: z.string().optional(),
  swellOutside: z.string().optional(),
  closestLowTide: z.object({ time: z.string(), height: z.number() }).optional(),
  closestHighTide: z.object({ time: z.string(), height: z.number() }).optional(),
});

export const FindSimilarDayInputSchema = z.object({
  spotContext: FishingSpotContextSchema,
  location: z.string(),
  searchRangeDays: z.number().default(14),
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
  score: z.coerce.number().describe("A confidence score from 0 to 100 on how good the match is."),
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

// Weather Summary Schemas
export const WeatherSummaryInputSchema = z.object({
  commune: z.string(),
  forecasts: z.array(z.object({
    date: z.string(),
    tempMin: z.number(),
    tempMax: z.number(),
    windSpeed: z.number(),
    windDirection: z.string(),
    uvIndex: z.number(),
    condition: z.string()
  }))
});
export type WeatherSummaryInput = z.infer<typeof WeatherSummaryInputSchema>;

export const WeatherSummaryOutputSchema = z.object({
  summary: z.string().describe("Analyse concise de la tendance météo sur 7 jours."),
  activities: z.string().describe("Conseils pratiques pour la pêche, la chasse ou le jardinage selon ces prévisions."),
  precautions: z.string().describe("Avertissements de sécurité (UV forts, vents, pluie).")
});
export type WeatherSummaryOutput = z.infer<typeof WeatherSummaryOutputSchema>;

// Fish Identification Schemas
export const IdentifyFishInputSchema = z.object({
  photoDataUri: z.string().describe("A photo of a fish as a data URI."),
});
export type IdentifyFishInput = z.infer<typeof IdentifyFishInputSchema>;

export const IdentifyFishOutputSchema = z.object({
  name: z.string().describe("Nom commun du poisson."),
  scientificName: z.string().describe("Nom scientifique."),
  gratteRisk: z.number().describe("Risque estimé de ciguatera en pourcentage (0-100)."),
  isSafeToEat: z.boolean().describe("Si le poisson est généralement considéré comme sûr à la consommation."),
  culinaryAdvice: z.string().describe("Conseils culinaires."),
  fishingAdvice: z.string().describe("Conseils de pêche."),
  description: z.string().describe("Brève description physique pour confirmation."),
});
export type IdentifyFishOutput = z.infer<typeof IdentifyFishOutputSchema>;

// Generate Fish Info (for Admin)
export const GenerateFishInfoInputSchema = z.object({
  name: z.string().describe("Nom commun du poisson local à la Nouvelle-Calédonie."),
});
export type GenerateFishInfoInput = z.infer<typeof GenerateFishInfoInputSchema>;

export const GenerateFishInfoOutputSchema = z.object({
  scientificName: z.string().describe("Nom scientifique officiel."),
  gratteRiskSmall: z.number().describe("Risque estimé de ciguatera pour petit spécimen (0-100)."),
  gratteRiskMedium: z.number().describe("Risque estimé de ciguatera pour moyen spécimen (0-100)."),
  gratteRiskLarge: z.number().describe("Risque estimé de ciguatera pour grand spécimen (0-100)."),
  lengthSmall: z.string().describe("Longueur estimée pour un petit spécimen (ex: '< 30cm')."),
  lengthMedium: z.string().describe("Longueur estimée pour un spécimen moyen (ex: '30-60cm')."),
  lengthLarge: z.string().describe("Longueur estimée pour un grand spécimen (ex: '> 60cm')."),
  culinaryAdvice: z.string().describe("Conseils de préparation culinaire."),
  fishingAdvice: z.string().describe("Conseils de techniques de pêche en NC."),
  category: z.enum(['Lagon', 'Large', 'Recif']).describe("Catégorie d'habitat."),
});
export type GenerateFishInfoOutput = z.infer<typeof GenerateFishInfoOutputSchema>;

// Recommend Best Spot (GPS + Current Context)
export const RecommendBestSpotInputSchema = z.object({
  currentContext: FishingSpotContextSchema,
  candidateSpots: z.array(z.object({
    id: z.string(),
    name: z.string(),
    distance: z.number().describe('Distance in meters'),
    historicalContext: FishingSpotContextSchema
  })),
  location: z.string(),
});
export type RecommendBestSpotInput = z.infer<typeof RecommendBestSpotInputSchema>;

export const RecommendBestSpotOutputSchema = z.object({
  bestSpotId: z.string(),
  bestSpotName: z.string(),
  reason: z.string().describe("Why this spot is recommended for current conditions."),
  confidence: z.coerce.number().describe("Score from 0 to 100."),
  advice: z.string().describe("Specific tactical advice for this spot right now.")
});
export type RecommendBestSpotOutput = z.infer<typeof RecommendBestSpotOutputSchema>;
