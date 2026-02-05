'use server';
/**
 * @fileOverview AI flow for generating a global daily summary for the user's entire garden.
 * STRICTURE CONSTRAINTS: Only uses plants provided in the input. No hallucinations.
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
    plantNames: z.array(z.string()).describe("List of ACTUAL plant names from the provided inventory."),
  })),
  maintenanceAlerts: z.array(z.object({
    priority: z.enum(['Haute', 'Moyenne', 'Basse']),
    action: z.string().describe("Specific action including the plant name."),
    reason: z.string().describe("Why this action is needed today."),
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

REGLE DE SÉCURITÉ CRITIQUE :
1. Tu ne dois utiliser QUE les noms de plantes listés dans la section "INVENTAIRE" ci-dessous.
2. Il est STRICTEMENT INTERDIT d'inventer, de suggérer ou de mentionner une plante qui n'est pas dans cette liste.
3. Si une section (Alertes ou Étapes clés) ne concerne aucune plante de la liste, retourne un tableau vide [] pour cette section.
4. N'utilise aucun exemple générique.

CONTEXTE DU JOUR :
- Lieu : {{{location}}}
- Date : {{{date}}}
- Météo : {{{weather.temp}}}°C, Pluie : {{{weather.rain}}}
- Lune : {{{lunarContext.phase}}} (Signe : {{{lunarContext.zodiac}}})

INVENTAIRE DES PLANTES DE L'UTILISATEUR (STRICTEMENT CES NOMS) :
{{#each plants}}
- {{{name}}} (Catégorie : {{{category}}})
{{/each}}

ACTIONS REQUISES :
1. globalPlan : Un résumé d'une phrase des priorités du jour pour CETTE liste.
2. wateringGroups : Groupe UNIQUEMENT les plantes de la liste par besoin en eau selon la météo et leur nature.
3. maintenanceAlerts : Identifie les besoins de taille (si lune descendante) ou d'engrais (si floraison prévue) pour les plantes de la liste.
4. milestones : Signale les étapes biologiques proches pour ces plantes spécifiques.

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
