'use server';
/**
 * @fileOverview AI flow for generating a global daily summary for the user's entire garden.
 * This flow is now strictly constrained to the user's inventory and uses real plant names.
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
    plantNames: z.array(z.string()).describe("List of ACTUAL plant names from the inventory."),
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
  const { output } = await ai.generate({
    prompt: `Tu es le Maître Jardinier de Nouvelle-Calédonie. Analyse l'ensemble de ce jardin pour aujourd'hui.
    
CONSIGNE CRITIQUE ET ABSOLUE :
Ta mission est de conseiller l'utilisateur EXCLUSIVEMENT et UNIQUEMENT sur les plantes listées dans son inventaire ci-dessous. 
IL EST FORMELLEMENT INTERDIT d'inventer, de suggérer ou de mentionner une plante (comme "Citronnier", "Hibiscus", "Bougainvillier") si elle ne figure pas dans la liste fournie par l'utilisateur. 
N'utilise aucun exemple générique.

CONTEXTE DU JOUR :
- Lieu : {{{location}}}
- Date : {{{date}}}
- Météo : {{{weather.temp}}}°C, Pluie : {{{weather.rain}}}
- Lune : {{{lunarContext.phase}}} (Signe : {{{lunarContext.zodiac}}})

INVENTAIRE RÉEL DU JARDIN (STRICTEMENT CES NOMS ET RIEN D'AUTRE) :
{{#each plants}}
- {{{name}}} ({{{category}}})
{{/each}}

TA MISSION :
1. Rédige un PLAN GLOBAL très concis pour la journée qui synthétise les priorités pour CET inventaire précis.
2. GROUPE les plantes de l'inventaire par besoin d'arrosage aujourd'hui. Utilise les NOMS EXACTS fournis.
3. IDENTIFIE les alertes de maintenance (Taille car lune descendante, ou Engrais car floraison proche) pour les plantes de l'inventaire.
4. SOIS PRÉCIS sur le "Pourquoi" en citant le nom de la plante.

RAPPEL : Si l'inventaire ne contient qu'une seule plante (ex: "Pamplemoussier"), ton bilan ne doit parler QUE de cette plante. Ne me donne aucune information sur d'autres arbres ou fleurs.

Réponds au format JSON uniquement.`,
    input: { schema: GardenGlobalSummaryInputSchema, data: input },
    output: { schema: GardenGlobalSummaryOutputSchema },
  });
  return output!;
}
