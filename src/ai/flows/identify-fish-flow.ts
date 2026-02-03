'use server';
/**
 * @fileOverview AI flow for identifying fish from photos in New Caledonia.
 * Focuses on finding the closest match by resemblance.
 */

import { ai } from '@/ai/genkit';
import {
  IdentifyFishInputSchema,
  IdentifyFishOutputSchema,
  type IdentifyFishInput,
  type IdentifyFishOutput,
} from '@/ai/schemas';

export async function identifyFish(input: IdentifyFishInput): Promise<IdentifyFishOutput> {
  return identifyFishFlow(input);
}

const identifyFishPrompt = ai.definePrompt({
  name: 'identifyFishPrompt',
  input: { schema: IdentifyFishInputSchema },
  output: { schema: IdentifyFishOutputSchema },
  prompt: `Tu es un expert en biologie marine spécialisé dans les poissons de Nouvelle-Calédonie.
Analyse cette photo prise par un pêcheur : {{media url=photoDataUri}}

TA MISSION :
1. Identifie le type de poisson qui ressemble le plus au spécimen sur la photo.
2. Si l'image est un peu floue, utilise les formes, les nageoires et les motifs pour trouver la meilleure correspondance parmi les espèces calédoniennes.
3. Donne son nom commun local (utilisé en NC) et son nom scientifique.
4. Évalue précisément le risque de "gratte" (ciguatera) pour cette espèce spécifiquement en Nouvelle-Calédonie.
5. Fournis des conseils culinaires (comment le préparer au mieux).
6. Donne des conseils de pêche (appâts, profondeur, zone).
7. Fournis une description physique courte pour que le pêcheur puisse confirmer ton identification.

IMPORTANT : Sois bienveillant et privilégie la sécurité alimentaire du pêcheur. Si le poisson est dangereux ou non comestible, mentionne-le clairement.

Réponds en français avec expertise et clarté.`,
});

const identifyFishFlow = ai.defineFlow(
  {
    name: 'identifyFishFlow',
    inputSchema: IdentifyFishInputSchema,
    outputSchema: IdentifyFishOutputSchema,
  },
  async (input) => {
    const { output } = await identifyFishPrompt(input);
    return output!;
  }
);
