'use server';
/**
 * @fileOverview AI flow for correcting plant names and suggesting local varieties specific to New Caledonia.
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
    prompt: `Tu es un expert botaniste et pépiniériste spécialisé dans la flore de Nouvelle-Calédonie. 
    L'utilisateur a saisi le nom suivant pour son jardin : "{{query}}".
    
    TA MISSION :
    1. Corrige l'orthographe du mot si nécessaire (ex: "Citronier" -> "Citronnier"). 
       ATTENTION : Ne change JAMAIS le type de plante. Si l'utilisateur écrit "Citronnier", ne propose pas "Mangue". Reste sur le végétal demandé.
    2. Détermine sa catégorie parmi : "Arbre Fruitier", "Potager", "Fleur", "Aromatique", "Autre".
    3. Propose une liste de 4 à 6 variétés ou types spécifiques qui sont **LES PLUS COURANTS, POPULAIRES ET RÉUSSIS EN NOUVELLE-CALÉDONIE** pour ce végétal précis.
       - Pour les fruitiers, utilise les noms locaux connus (ex: Mangue Carotte, Mangue Greffe, Citron Galet, Banane Poingo, etc.).
       - Pour le potager, cite les variétés qui supportent bien le climat tropical (ex: Tomate Heatmaster).
    
    Réponds au format JSON.`,
    input: input,
    output: {
      schema: RefinePlantOutputSchema,
    }
  });
  return output!;
}
