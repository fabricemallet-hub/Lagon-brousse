
'use server';
/**
 * @fileOverview AI flow for generating personalized garden maintenance advice.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const GardenAdviceInputSchema = z.object({
  plantName: z.string().describe("The name of the plant or tree."),
  category: z.string().describe("Plant category (Arbre fruitier, potager, etc.)."),
  location: z.string().describe("User location in New Caledonia."),
  temperature: z.number().describe("Current air temperature."),
  rain: z.string().describe("Current rain condition."),
  lunarPhase: z.string().describe("Current moon phase."),
  zodiac: z.string().describe("Current zodiac influence."),
});
export type GardenAdviceInput = z.infer<typeof GardenAdviceInputSchema>;

const GardenAdviceOutputSchema = z.object({
  watering: z.object({
    advice: z.string().describe("Precise watering advice for today."),
    quantity: z.string().describe("Estimated quantity of water (e.g., '5L', '10L', 'Arrosage léger')."),
  }),
  maintenance: z.object({
    shouldPrune: z.boolean().describe("Whether pruning is recommended today."),
    pruningGuide: z.string().describe("Detailed guide on HOW, WHERE and WHY to prune this specific plant based on the moon."),
    boosterAdvice: z.string().describe("Advice on fertilizer or boosters to maximize yield/flowering."),
  }),
  milestones: z.object({
    flowering: z.string().describe("Prediction about next flowering period."),
    yieldTips: z.string().describe("Key tips for maximum yield in NC climate."),
  }),
});
export type GardenAdviceOutput = z.infer<typeof GardenAdviceOutputSchema>;

export async function getPersonalizedGardenAdvice(input: GardenAdviceInput): Promise<GardenAdviceOutput> {
  return gardenAdviceFlow(input);
}

const gardenAdvicePrompt = ai.definePrompt({
  name: 'gardenAdvicePrompt',
  input: { schema: GardenAdviceInputSchema },
  output: { schema: GardenAdviceOutputSchema },
  prompt: `Tu es un expert agronome et jardinier traditionnel en Nouvelle-Calédonie. 
Ta mission est de conseiller un utilisateur sur l'entretien de sa plante : {{{plantName}}} (Catégorie : {{{category}}}).

CONTEXTE DU JOUR À {{{location}}} :
- Température : {{{temperature}}}°C
- Pluie prévue : {{{rain}}}
- Lune : {{{lunarPhase}}} (Signe : {{{zodiac}}})

CONSIGNES DÉTAILLÉES :
1. ARROSAGE : Calcule la dose d'eau idéale. Tiens compte de la pluie (si il pleut fort, dis de ne pas arroser). Sois précis (ex: "10L au pied", "Brumisation").
2. TAILLE :
   - Vérifie si la lune permet la taille (Lune descendante = OK pour la taille, Lune montante = Éviter).
   - Explique précisément OÙ couper (ex: "au dessus du 3ème œil", "couper les gourmands à la base").
   - Explique POURQUOI le faire (ex: "pour favoriser la sève vers les fruits", "pour aérer le cœur de l'arbre").
   - Donne un conseil visuel : ce qu'il faut regarder (taches, couleur des tiges, orientation des bourgeons).
3. NUTRITION & BOOST : Suggère un apport (compost, purin de fougère, engrais NPK spécifique) pour préparer la floraison ou fortifier la plante.
4. RENDEMENT : Donne 2 astuces de "vieux jardinier" du Caillou pour que cette plante donne le meilleur d'elle-même.

Réponds avec expertise, pédagogie et bienveillance en français.`,
});

const gardenAdviceFlow = ai.defineFlow(
  {
    name: 'gardenAdviceFlow',
    inputSchema: GardenAdviceInputSchema,
    outputSchema: GardenAdviceOutputSchema,
  },
  async (input) => {
    const { output } = await gardenAdvicePrompt(input);
    return output!;
  }
);
