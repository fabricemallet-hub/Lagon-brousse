'use server';
/**
 * @fileOverview AI flow for correcting plant names and suggesting local varieties specific to New Caledonia.
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';

const RefinePlantInputSchema = z.object({
  query: z.string().describe("The raw plant name entered by the user."),
});
export type RefinePlantInput = z.infer<typeof RefinePlantInputSchema>;

const RefinePlantOutputSchema = z.object({
  correctedName: z.string().describe("The correctly spelled common name of the plant."),
  category: z.enum(["Arbre Fruitier", "Potager", "Fleur", "Aromatique", "Autre"]).describe("The botanical category."),
  varieties: z.array(z.string()).describe("A list of 4-6 specific varieties or types common in New Caledonia."),
});
export type RefinePlantOutput = z.infer<typeof RefinePlantOutputSchema>;

export async function refinePlantInput(input: RefinePlantInput): Promise<RefinePlantOutput> {
  return refinePlantFlow(input);
}

const refinePlantPrompt = ai.definePrompt({
  name: 'refinePlantPrompt',
  input: { schema: RefinePlantInputSchema },
  output: { schema: RefinePlantOutputSchema },
  prompt: `Tu es un expert botaniste et pépiniériste spécialisé dans la flore tropicale de Nouvelle-Calédonie.
    L'utilisateur a saisi le nom suivant pour son jardin : "{{query}}".
    
    TA MISSION :
    1. CORRECTION : Si le mot est mal orthographié, corrige-le (ex: "citronier" -> "Citronnier"). 
       IMPORTANT : Si l'utilisateur saisit le nom d'un fruit (ex: "Mangue", "Citron", "Litchi", "Goyave", "Avocat"), convertis-le systématiquement en nom d'arbre fruitier (ex: "Manguier", "Citronnier", "Litchi", "Goyavier", "Avocatier") dans le champ 'correctedName'.
    2. CONSERVATION DE L'ESPÈCE (CRITIQUE) : Tu ne dois JAMAIS changer le type de végétal. Si l'utilisateur saisit un agrume, reste sur un agrume. Ne propose jamais "Tomate" si l'utilisateur a écrit "Citronnier". 
    3. CATÉGORISATION : Détermine sa catégorie parmi : "Arbre Fruitier", "Potager", "Fleur", "Aromatique", "Autre".
    4. VARIÉTÉS NC : Propose une liste de 4 à 6 variétés ou types spécifiques qui sont LES PLUS COURANTS, POPULAIRES ET RÉUSSIS EN NOUVELLE-CALÉDONIE pour ce végétal précis.
       - Utilise les noms locaux connus (ex pour Manguier : Mangue Carotte, Mangue Greffe, Mangue de Tahiti).
       - Utilise les variétés adaptées au climat tropical (ex pour Tomate : Heatmaster, Floradade).
    
    RESTE STRICT SUR L'IDENTITÉ DU VÉGÉTAL SAISI. Réponds au format JSON.`,
});

const refinePlantFlow = ai.defineFlow(
  {
    name: 'refinePlantFlow',
    inputSchema: RefinePlantInputSchema,
    outputSchema: RefinePlantOutputSchema,
  },
  async (input) => {
    const { output } = await refinePlantPrompt(input);
    return output!;
  }
);
