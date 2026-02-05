'use server';
/**
 * @fileOverview AI flow for generating a global daily summary for the user's entire garden.
 * Integrates weather data, precise watering (liters/seconds), and pruning advice.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const GardenGlobalSummaryInputSchema = z.object({
  location: z.string(),
  date: z.string(),
  weather: z.object({
    temp: z.number(),
    rain: z.string(),
  }),
  lunarContext: z.object({
    phase: z.string(),
    zodiac: z.string(),
  }),
  plants: z.array(z.object({
    name: z.string(),
    category: z.string(),
    individualAdvice: z.any().optional(),
  })),
});
export type GardenGlobalSummaryInput = z.infer<typeof GardenGlobalSummaryInputSchema>;

const GardenGlobalSummaryOutputSchema = z.object({
  globalPlan: z.string().describe("Concise global action plan for today."),
  wateringGroups: z.array(z.object({
    type: z.string().describe("Type of watering (e.g., 'Abondant', 'Léger')."),
    quantityPerPlant: z.string().describe("Water quantity per plant in liters and seconds (e.g. '5L / ~25s au jet')."),
    plantNames: z.array(z.string()).describe("List of ACTUAL plant names from the provided inventory."),
  })),
  maintenanceAlerts: z.array(z.object({
    priority: z.enum(['Haute', 'Moyenne', 'Basse']),
    action: z.string().describe("Specific action (e.g. 'Taille du Manguier')."),
    reason: z.string().describe("Why this action is needed (Pruning, Fertilizer, etc.)."),
    howTo: z.string().optional().describe("Quick instruction on how to do it."),
  })),
  milestones: z.array(z.object({
    plantName: z.string().describe("Actual name of the plant."),
    event: z.string().describe("Upcoming flowering, harvest or specific phase."),
  })),
});
export type GardenGlobalSummaryOutput = z.infer<typeof GardenGlobalSummaryOutputSchema>;

export async function getGardenGlobalSummary(input: GardenGlobalSummaryInput): Promise<GardenGlobalSummaryOutput> {
  return gardenGlobalSummaryFlow(input);
}

const gardenGlobalSummaryPrompt = ai.definePrompt({
  name: 'gardenGlobalSummaryPrompt',
  input: { schema: GardenGlobalSummaryInputSchema },
  output: { schema: GardenGlobalSummaryOutputSchema },
  prompt: `Tu es l'Expert Jardinier de Nouvelle-Calédonie. 
Ta mission est de rédiger un bilan quotidien pour l'inventaire RÉEL fourni par l'utilisateur.

CONTEXTE DU JOUR :
- Lieu : {{{location}}}
- Date : {{{date}}}
- Météo : {{{weather.temp}}}°C, Pluie : {{{weather.rain}}}
- Lune : {{{lunarContext.phase}}} (Signe : {{{lunarContext.zodiac}}})

INVENTAIRE DES PLANTES DE L'UTILISATEUR (STRICTEMENT CES NOMS) :
{{#each plants}}
- {{{name}}} (Catégorie : {{{category}}})
{{/each}}

CONSIGNES CRITIQUES :
1. METEO : Si il a plu ou va pleuvoir fort (Météo: Forte), réduis ou annule les besoins en arrosage. Si il fait très chaud (>30°C), augmente-les.
2. ARROSAGE : Pour chaque groupe de plantes, donne une estimation de la quantité d'eau par plante en Litres ET en temps de jet (en secondes, base: un jet standard débite environ 10-15L/min, soit ~0.2L/s). Ex: "5L (~25s au jet)".
3. TAILLE (PRUNING) : Si la lune est Descendante, identifie les arbres ou arbustes de la liste qui nécessitent une taille de formation ou d'entretien. Donne un conseil court sur OÙ couper.
4. Hallucinations INTERDITES : N'invente AUCUNE plante. Si la liste est vide ou si une section ne s'applique à aucune plante de la liste, retourne un tableau vide [].

RÉPONDS UNIQUEMENT AU FORMAT JSON.`,
});

const gardenGlobalSummaryFlow = ai.defineFlow(
  {
    name: 'gardenGlobalSummaryFlow',
    inputSchema: GardenGlobalSummaryInputSchema,
    outputSchema: GardenGlobalSummaryOutputSchema,
  },
  async (input) => {
    const { output } = await gardenGlobalSummaryPrompt(input);
    return output!;
  }
);
