'use server';
/**
 * @fileOverview AI flow for correcting plant names and suggesting local varieties.
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';

const RefinePlantInputSchema = z.object({
  query: z.string().describe("The raw plant name entered by the user."),
});

const RefinePlantOutputSchema = z.object({
  correctedName: z.string().describe("The correctly spelled common name of the plant."),
  category: z.enum(["Arbre Fruitier", "Potager", "Fleur", "Aromatique", "Autre"]).describe("The botanical category."),
  varieties: z.array(z.string()).describe("A list of 4-6 specific varieties or types common in New Caledonia."),
});

export async function refinePlantInput(input: { query: string }) {
  const { output } = await ai.generate({
    prompt: `Tu es un expert botaniste et pépiniériste en Nouvelle-Calédonie. 
    L'utilisateur a saisi le nom suivant pour son jardin : "{{{query}}}".
    
    TA MISSION :
    1. Corrige l'orthographe du mot si nécessaire (ex: "Citronier" -> "Citronnier").
    2. Détermine sa catégorie parmi : "Arbre Fruitier", "Potager", "Fleur", "Aromatique", "Autre".
    3. Propose une liste de 4 à 6 variétés ou types spécifiques que l'on trouve couramment en Nouvelle-Calédonie pour ce végétal.
    
    Réponds au format JSON.`,
    input: {
      schema: RefinePlantInputSchema,
      data: input,
    },
    output: {
      schema: RefinePlantOutputSchema,
    }
  });
  return output!;
}
