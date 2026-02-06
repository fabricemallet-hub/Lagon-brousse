'use server';
/**
 * @fileOverview AI flow for identifying plants, seeds, or pests in New Caledonia.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const IdentifyPlantInputSchema = z.object({
  photoDataUri: z.string().describe("A photo of a plant, seed or pest as a data URI."),
});
export type IdentifyPlantInput = z.infer<typeof IdentifyPlantInputSchema>;

const IdentifyPlantOutputSchema = z.object({
  name: z.string().describe("Nom commun de la plante ou du nuisible."),
  category: z.enum(["Arbre Fruitier", "Potager", "Fleur", "Aromatique", "Nuisible", "Autre"]).describe("Catégorie."),
  description: z.string().describe("Description courte pour confirmation."),
  advice: z.string().describe("Conseil immédiat d'entretien ou de traitement spécifique à la NC."),
  isActionRequired: z.boolean().describe("Si une action urgente est nécessaire."),
});
export type IdentifyPlantOutput = z.infer<typeof IdentifyPlantOutputSchema>;

export async function identifyPlant(input: IdentifyPlantInput): Promise<IdentifyPlantOutput> {
  return identifyPlantFlow(input);
}

const identifyPlantFlow = ai.defineFlow(
  {
    name: 'identifyPlantFlow',
    inputSchema: IdentifyPlantInputSchema,
    outputSchema: IdentifyPlantOutputSchema,
  },
  async (input) => {
    const { output } = await ai.generate({
      prompt: [
        { text: `Tu es un expert botaniste et agronome en Nouvelle-Calédonie. 
        Analyse cette photo prise dans un jardin ou une brousse calédonienne.
        
        TA MISSION :
        1. Identifie la plante, la graine ou le nuisible.
        2. Donne son nom commun local utilisé sur le Caillou.
        3. Catégorise-le précisément.
        4. Fournis un conseil d'entretien ou de traitement adapté au climat tropical de NC.
        5. Précise si c'est une espèce envahissante ou si une action urgente est requise.` },
        { media: { url: input.photoDataUri } }
      ],
      output: { schema: IdentifyPlantOutputSchema }
    });
    return output!;
  }
);
