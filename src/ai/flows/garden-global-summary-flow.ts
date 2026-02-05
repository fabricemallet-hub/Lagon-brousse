'use server';
/**
 * @fileOverview AI flow for generating a global daily summary for the user's entire garden.
 * This flow is now strictly constrained to the user's inventory.
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
    plantNames: z.array(z.string()),
  })),
  maintenanceAlerts: z.array(z.object({
    priority: z.enum(['Haute', 'Moyenne', 'Basse']),
    action: z.string(),
    reason: z.string(),
  })),
  milestones: z.array(z.object({
    plantName: z.string(),
    event: z.string().describe("Upcoming flowering, harvest or specific phase."),
  })),
});
export type GardenGlobalSummaryOutput = z.infer<typeof GardenGlobalSummaryOutputSchema>;

export async function getGardenGlobalSummary(input: GardenGlobalSummaryInput): Promise<GardenGlobalSummaryOutput> {
  const { output } = await ai.generate({
    prompt: `Tu es le Maître Jardinier de Nouvelle-Calédonie. Analyse l'ensemble de ce jardin pour aujourd'hui.
    
IMPORTANT : Ta mission est de conseiller l'utilisateur UNIQUEMENT sur les plantes listées dans son inventaire ci-dessous. 
Ne suggère jamais de plantes qui ne sont pas dans cette liste.

CONTEXTE :
- Lieu : {{{location}}}
- Date : {{{date}}}
- Météo : {{{weather.temp}}}°C, Pluie : {{{weather.rain}}}
- Lune : {{{lunarContext.phase}}} (Signe : {{{lunarContext.zodiac}}})

INVENTAIRE RÉEL DU JARDIN (CONSEILS UNIQUEMENT POUR CES PLANTES) :
{{#each plants}}
- {{{name}}} ({{{category}}})
{{/each}}

TA MISSION :
1. Rédige un PLAN GLOBAL très concis pour la journée qui synthétise les priorités pour cet inventaire précis.
2. GROUPE les plantes de l'inventaire par besoin d'arrosage aujourd'hui.
3. IDENTIFIE les alertes de maintenance (Taille car lune descendante, ou Engrais car floraison proche) pour les plantes de l'inventaire.
4. SOIS PRÉCIS sur le "Pourquoi" (ex: "Mettre de l'engrais sur le {{{plants.0.name}}} pour booster la floraison car nous sommes en saison").

Réponds au format JSON uniquement.`,
    input: { schema: GardenGlobalSummaryInputSchema, data: input },
    output: { schema: GardenGlobalSummaryOutputSchema },
  });
  return output!;
}
